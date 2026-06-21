// ISPD Computation Engine (包含针对 PTFE 等强束缚超强绝缘体的全景推演补全机制)
var ISPD = (function() {
  'use strict';
  
  // 定义物理常数
  var K_B = 8.617e-5;      // 玻尔兹曼常数 (eV/K)
  var EPS_0 = 8.854e-12;   // 真空介电常数 (F/m)
  var E_CHARGE = 1.602e-19;// 基本电荷量 (C)

  function compute(t, v, T, nu, eps_r, d_um) {
    // 处理默认参数
    T = T || 300; 
    nu = nu || 1e12; 
    eps_r = eps_r || 3.0; 
    d_um = d_um || 50;

    // Step 1: 核心 Levenberg-Marquardt 双指数拟合
    var vDrop = v[0] - v[v.length - 1];
    var tRange = t[t.length - 1] - t[0];
    var fit = LM.fitDoubleExponential(t, v, vDrop, tRange);
    
    if (!fit || !fit.success) {
        return { success: false };
    }
    
    var A1 = fit.A1, tau1 = fit.tau1, A2 = fit.A2, tau2 = fit.tau2, y0 = fit.y0;
    var r2 = fit.r2, v0 = v[0];

    // 物理防呆机制：强制保证 tau1 对应短时间(浅陷阱)，tau2 对应长时间(深陷阱)
    if (tau1 > tau2) {
        var tmpA = A1, tmpTau = tau1;
        A1 = A2; tau1 = tau2;
        A2 = tmpA; tau2 = tmpTau;
    }

    // Step 2: 构建用于绘制连续能谱的高分辨率时间数组 (核心推演逻辑)
    var tMin = Math.max(t[0] || 1e-3, 1e-3);
    var tMax = t[t.length - 1];

    // ====================================================================
    // 【时间窗外推推演截断补偿系统】
    // 如果是 PTFE 这种超级绝缘材料，其真实弛豫时间 tau2 远超实验测试时长。
    // 我们必须打破 tMax 的限制，将坐标轴时间推演至足以包络 tau2 为止。
    // 最大推演范围允许至测量时间的 1e5 倍，以画出完美的闭合高斯峰！
    // ====================================================================
    var tMaxPlot = Math.max(tMax, Math.min(tau2 * 3.0, tMax * 1e5));

    // 使用 1000 个点保证曲线画出来的绝对平滑
    var nD = 1000; 
    var tDense = new Array(nD);
    for (var i = 0; i < nD; i++) {
      // 对数域均匀分配点
      var logT = Math.log10(tMin) + (Math.log10(tMaxPlot) - Math.log10(tMin)) * (i / (nD - 1));
      tDense[i] = Math.pow(10, logT);
    }

    // Step 3: 根据理论重构解析导数计算能级深度 E_t 与面陷阱密度 N_t
    var d_m = d_um * 1e-6;
    var C_factor = (EPS_0 * eps_r) / (E_CHARGE * d_m); // 面密度系数 (去掉 L 的严谨版)
    
    var E_t = new Array(nD), N_t = new Array(nD), vDense = new Array(nD);
    for (var i = 0; i < nD; i++) {
      var curT = tDense[i];
      // Simmons 能量映射定律
      E_t[i] = K_B * T * Math.log(nu * curT);
      
      // 解析推导，避免离散求导带来的噪声雪崩
      var dV_dt = -(A1/tau1)*Math.exp(-curT/tau1) - (A2/tau2)*Math.exp(-curT/tau2);
      
      // N_t ∝ t * |dV/dt|
      N_t[i] = C_factor * Math.abs(curT * dV_dt);
      
      // 记录重构的平滑衰减电压，用于在第一张图表上显示
      vDense[i] = A1 * Math.exp(-curT/tau1) + A2 * Math.exp(-curT/tau2) + y0;
    }

    // Step 4: 极值解析与双峰特征精准锁定
    // 理论上，双指数主导下的陷阱分布极值，严格出现在 t = tau1 与 t = tau2 时刻
    var shallow_E = K_B * T * Math.log(nu * tau1);
    var deep_E    = K_B * T * Math.log(nu * tau2);
    
    var shallow_dV = -(A1/tau1)*Math.exp(-1) - (A2/tau2)*Math.exp(-tau1/tau2);
    var shallow_N = C_factor * Math.abs(tau1 * shallow_dV);

    var deep_dV = -(A1/tau1)*Math.exp(-tau2/tau1) - (A2/tau2)*Math.exp(-1);
    var deep_N = C_factor * Math.abs(tau2 * deep_dV);

    return {
      success: true,
      tDense: tDense,     // 画图用密集时间轴
      vDense: vDense,     // 画图用平滑电压值
      E_t: E_t,           // 画图用能级深度轴 (横坐标)
      N_t: N_t,           // 画图用陷阱密度轴 (纵坐标)
      shallow_E: shallow_E, // 浅陷阱主峰能级
      shallow_N: shallow_N, // 浅陷阱主峰密度
      deep_E: deep_E,       // 深陷阱主峰能级
      deep_N: deep_N,       // 深陷阱主峰密度
      A1: A1, tau1: tau1, 
      A2: A2, tau2: tau2, 
      y0: y0, r2: r2, v0: v0
    };
  }

  // 暴露公共接口
  return { compute: compute };
})();
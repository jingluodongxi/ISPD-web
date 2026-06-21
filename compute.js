// ISPD Computation Engine
var ISPD = (function() {
  'use strict';
  // 基础物理常数
  var K_B = 8.617e-5, EPS_0 = 8.854e-12, E_CHARGE = 1.602e-19;

  function compute(t, v, T, nu, eps_r, d_um) {
    T = T || 300; nu = nu || 1e12; eps_r = eps_r || 3.0; d_um = d_um || 50;

    // Step 1: 调用 LM 引擎进行全局非线性拟合
    var vDrop = v[0] - v[v.length - 1], tRange = t[t.length - 1] - t[0];
    var fit = LM.fitDoubleExponential(t, v, vDrop, tRange);
    
    // 【修复点 1】如果拟合失败，返回空 peaks 数组，防止前端 forEach 报错
    if (!fit || !fit.success) return { success: false, peaks: [] };

    var A1 = fit.A1, tau1 = fit.tau1, A2 = fit.A2, tau2 = fit.tau2, y0 = fit.y0;
    var r2 = fit.r2, v0 = v[0];

    // 物理防呆修正：强制保证 tau1(浅陷阱) < tau2(深陷阱)
    if (tau1 > tau2) {
        var tempA = A1, tempTau = tau1;
        A1 = A2; tau1 = tau2;
        A2 = tempA; tau2 = tempTau;
    }

    // Step 2: 构建高分辨率时间数组 (核心推演逻辑)
    var tMin = Math.max(t[0] || 1e-3, 1e-3);
    var tMax = t[t.length - 1];

    // 【解除封印：无限视界外推】
    // 将 X 轴的最大绘制时间点强制延伸至深陷阱时间常数 tau2 的 3.5 倍。
    var tMaxPlot = Math.max(tMax, tau2 * 3.5);

    var nD = 1000; 
    var tDense = new Array(nD);
    var vDense = new Array(nD);
    for (var i = 0; i < nD; i++) {
      var logT = Math.log10(tMin) + (Math.log10(tMaxPlot) - Math.log10(tMin)) * (i / (nD - 1));
      var curT = Math.pow(10, logT);
      tDense[i] = curT;
      vDense[i] = A1 * Math.exp(-curT/tau1) + A2 * Math.exp(-curT/tau2) + y0;
    }

    // Step 3: 能量映射 (E_t) 与 面陷阱密度反演 (N_t)
    var d_m = d_um * 1e-6;
    var C = (EPS_0 * eps_r) / (E_CHARGE * d_m); 
    var E_t = new Array(nD), N_t = new Array(nD);
    for (var i = 0; i < nD; i++) {
      E_t[i] = K_B * T * Math.log(nu * tDense[i]);
      var dV = -(A1/tau1)*Math.exp(-tDense[i]/tau1) - (A2/tau2)*Math.exp(-tDense[i]/tau2);
      N_t[i] = C * Math.abs(tDense[i] * dV);
    }

    // Step 4: 锁定主峰位置
    var shallow_E = K_B * T * Math.log(nu * tau1);
    var deep_E = K_B * T * Math.log(nu * tau2);
    
    var shallow_dV = -(A1/tau1)*Math.exp(-1) - (A2/tau2)*Math.exp(-tau1/tau2);
    var shallow_N = C * Math.abs(tau1 * shallow_dV);

    var deep_dV = -(A1/tau1)*Math.exp(-tau2/tau1) - (A2/tau2)*Math.exp(-1);
    var deep_N = C * Math.abs(tau2 * deep_dV);

    // =======================================================
    // 【修复点 2】恢复 peaks 数组，图表引擎画星星全靠它！
    // =======================================================
    var peaks = [];
    if (isFinite(shallow_E) && isFinite(shallow_N)) peaks.push({E: shallow_E, N: shallow_N});
    if (isFinite(deep_E) && isFinite(deep_N)) peaks.push({E: deep_E, N: deep_N});

    return {
      success: true,
      tDense: tDense, vDense: vDense, E_t: E_t, N_t: N_t,
      peaks: peaks, // <--- 画图续命关键！
      shallow_E: shallow_E, shallow_N: shallow_N, 
      deep_E: deep_E, deep_N: deep_N,
      A1: A1, tau1: tau1, A2: A2, tau2: tau2, y0: y0, r2: r2, v0: v0
    };
  }

  return { compute: compute };
})();
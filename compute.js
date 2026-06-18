// ISPD Computation Engine
var ISPD = (function() {
'use strict';
var K_B = 8.617e-5, EPS_0 = 8.854e-12, E_CHARGE = 1.602e-19;

function compute(t, v, T, nu, eps_r, d_um) {
  T = T || 300; nu = nu || 1e12; eps_r = eps_r || 3.0; d_um = d_um || 50;

  // Step 1: Fit
  var vDrop = v[0] - v[v.length - 1], tRange = t[t.length - 1] - t[0];
  var fit = LM.fitDoubleExponential(t, v, vDrop, tRange);
  var A1 = fit.A1, tau1 = fit.tau1, A2 = fit.A2, tau2 = fit.tau2, y0 = fit.y0;
  var r2 = fit.r2, v0 = v[0];

  // y0 safety: prevent collapse for slow-decay data
  if (y0 < v[v.length-1] * 0.5) y0 = v[v.length-1] * 0.5;

  // Step 2: t_dense
  var v0Amp = Math.abs(v[0] - y0);
  var tMin = Math.max(t[0]||1e-3, 1e-3), tMax = t[t.length - 1];
  if (v0Amp > 0) {
    var maxTau = Math.max(Math.abs(tau1), Math.abs(tau2));
    tMax = Math.max(tMax, maxTau * 4.605);
  }
  tMax = Math.min(tMax, (t[t.length - 1] || 1) * 1000);

  var nD = 1000, logMin = Math.log10(tMin), logMax = Math.log10(tMax);
  var tDense = new Array(nD), vDense = new Array(nD);
  for (var i = 0; i < nD; i++) {
    tDense[i] = Math.pow(10, logMin + (logMax - logMin) * i / (nD - 1));
    vDense[i] = A1 * Math.exp(-tDense[i] / tau1) + A2 * Math.exp(-tDense[i] / tau2) + y0;
  }

  // Step 3: E_t and N_t
  var d_m = d_um * 1e-6, C = (EPS_0 * eps_r) / (E_CHARGE * d_m);
  var E_t = new Array(nD), N_t = new Array(nD);
  for (var i = 0; i < nD; i++) {
    E_t[i] = K_B * T * Math.log(nu * tDense[i]);
    var dV = -(A1/tau1)*Math.exp(-tDense[i]/tau1) - (A2/tau2)*Math.exp(-tDense[i]/tau2);
    N_t[i] = C * Math.abs(tDense[i] * dV);
  }

  // Step 4: Component-wise peaks
  var Es = K_B * T * Math.log(nu * tau1), Ed = K_B * T * Math.log(nu * tau2);
  var iS = 0, iD = 0, dS = Infinity, dD = Infinity;
  for (var i = 0; i < nD; i++) {
    var aS = Math.abs(E_t[i] - Es), aD = Math.abs(E_t[i] - Ed);
    if (aS < dS) { dS = aS; iS = i; }
    if (aD < dD) { dD = aD; iD = i; }
  }

  // Output
  function sf(x, fb) { return (isFinite(x) && x !== null) ? x : fb; }
  var tLog = t.map(function(x) { return Math.log10(x); });
  var tLogD = tDense.map(function(x) { return Math.log10(x); });
  var maxNt = Math.max.apply(null, N_t);

  return {
    r2: sf(r2, 0), v0: sf(v0, 0),
    A1: sf(A1,0), tau1: sf(tau1,1), A2: sf(A2,0), tau2: sf(tau2,1), y0: sf(y0,0),
    shallow_E: E_t[iS], shallow_N: N_t[iS],
    deep_E: E_t[iD], deep_N: N_t[iD],
    tDense: tDense.map(function(x){return sf(x,0);}),
    vDense: vDense.map(function(x){return sf(x,0);}),
    E_t: E_t.map(function(x){return sf(x,0);}),
    N_t: N_t.map(function(x){return sf(x,0);}),
    tLog: tLog, vRaw: v, tLogDense: tLogD, maxNt: maxNt
  };
}
return { compute: compute };
})();

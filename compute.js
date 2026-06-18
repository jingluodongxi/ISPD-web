// ISPD Computation Engine — output format exactly matches app.js expectations
var ISPD = (function() {
'use strict';

var K_B = 8.617e-5, EPS_0 = 8.854e-12, E_CHARGE = 1.602e-19;

function compute(t, v, T, nu, eps_r, d_um) {
  T = T || 300; nu = nu || 1e12; eps_r = eps_r || 3.0; d_um = d_um || 50;

  // Step 1: Fit double exponential
  var vDrop = v[0] - v[v.length - 1];
  var tRange = t[t.length - 1] - t[0];
  var fit = LM.fitDoubleExponential(t, v, vDrop, tRange);
  var A1 = fit.A1, tau1 = fit.tau1, A2 = fit.A2, tau2 = fit.tau2, y0 = fit.y0;
  var r2 = fit.r2, v0 = v[0];

  // Post-fit: prevent y0 collapsing to zero for slow-decay data
  if (y0 < v[v.length-1] * 0.3) { y0 = v[v.length-1] * 0.5; }

  // Step 2: Generate dense time grid (log-spaced)
  var v0Amplitude = Math.abs(v[0] - y0);
  var tMin = Math.max(Math.min.apply(null, t), 1e-3);
  var tMax = Math.max.apply(null, t);
  if (v0Amplitude > 0) {
    var maxTau = Math.max(Math.abs(tau1), Math.abs(tau2));
    var tDecay = maxTau * 4.605;
    tMax = Math.max(tMax, tDecay);
  }
  tMax = Math.min(tMax, Math.max.apply(null, t) * 1000);

  var nDense = 1000;
  var logMin = Math.log10(tMin), logMax = Math.log10(tMax);
  var tDense = new Array(nDense), vDense = new Array(nDense);
  for (var i = 0; i < nDense; i++) {
    tDense[i] = Math.pow(10, logMin + (logMax - logMin) * i / (nDense - 1));
    vDense[i] = LM.doubleExpModel([A1, tau1, A2, tau2, y0], tDense[i]);
  }

  // Step 3: Compute E_t and N_t
  var d_m = d_um * 1e-6;
  var C_factor = (EPS_0 * eps_r) / (E_CHARGE * d_m);
  var E_t = new Array(nDense), N_t = new Array(nDense);
  for (var i = 0; i < nDense; i++) {
    E_t[i] = K_B * T * Math.log(nu * tDense[i]);
    var dVdt = -(A1/tau1) * Math.exp(-tDense[i]/tau1) - (A2/tau2) * Math.exp(-tDense[i]/tau2);
    N_t[i] = C_factor * Math.abs(tDense[i] * dVdt);
  }

  // Step 4: Find peaks — component-wise (always detect both)
  var E_shallow = K_B * T * Math.log(nu * tau1);
  var E_deep    = K_B * T * Math.log(nu * tau2);

  var idxS = 0, idxD = 0, dSmin = Infinity, dDmin = Infinity;
  for (var i = 0; i < nDense; i++) {
    var dS = Math.abs(E_t[i] - E_shallow);
    var dD = Math.abs(E_t[i] - E_deep);
    if (dS < dSmin) { dSmin = dS; idxS = i; }
    if (dD < dDmin) { dDmin = dD; idxD = i; }
  }
  var shallow_E = E_t[idxS], shallow_N = N_t[idxS];
  var deep_E   = E_t[idxD], deep_N   = N_t[idxD];

  // Step 5: Log-transformed data for plotting
  var tLog = t.map(function(x) { return Math.log10(x); });
  var tLogDense = tDense.map(function(x) { return Math.log10(x); });
  var maxNt = Math.max.apply(null, N_t);

  // NaN protection
  function safe(v, fb) { return (isFinite(v) && v !== null) ? v : fb; }

  return {
    r2: safe(r2, 0), v0: safe(v0, 0),
    A1: safe(A1, 0), tau1: safe(tau1, 1), A2: safe(A2, 0), tau2: safe(tau2, 1), y0: safe(y0, 0),
    shallow_E: shallow_E, shallow_N: shallow_N,
    deep_E: deep_E, deep_N: deep_N,
    tDense: tDense.map(function(x){return safe(x,0);}),
    vDense: vDense.map(function(x){return safe(x,0);}),
    E_t: E_t.map(function(x){return safe(x,0);}),
    N_t: N_t.map(function(x){return safe(x,0);}),
    tLog: tLog, vRaw: v,
    tLogDense: tLogDense, maxNt: maxNt
  };
}

return { compute: compute };
})();

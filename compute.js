// ISPD Physics Computation Engine (client-side, no server needed)
var ISPD = (function() {
'use strict';

// Physical constants
var K_B = 8.617e-5;    // eV/K
var EPS_0 = 8.854e-12; // F/m
var E_CHARGE = 1.602e-19; // C

// Analytic derivative: dV/d(ln t) = t * dV/dt
// For double exponential: dV/dt = -(A1/tau1)*exp(-t/tau1) - (A2/tau2)*exp(-t/tau2)
function analyticDerivative(t, A1, tau1, A2, tau2) {
  var dVdt = -(A1 / tau1) * Math.exp(-t / tau1) - (A2 / tau2) * Math.exp(-t / tau2);
  return t * dVdt;
}

// Full ISPD computation
// t, v: raw data arrays
// T: temperature (K)
// nu: escape frequency (s^-1)
// eps_r: relative permittivity
// d_um: insulator thickness (um)
function compute(t, v, T, nu, eps_r, d_um) {
  T = T || 300;
  nu = nu || 1e12;
  eps_r = eps_r || 3.0;
  d_um = d_um || 50;

  // Step 1: Fit double exponential
  var fit = LM.fitDoubleExponential(t, v);
  var A1 = fit.A1, tau1 = fit.tau1, A2 = fit.A2, tau2 = fit.tau2, y0 = fit.y0;
  var r2 = fit.r2;
  var v0 = v[0];

  // Step 2: Generate dense time grid (log-spaced)
  var tMin = Math.max(Math.min.apply(null, t), 1e-3);
  var tMax = Math.max.apply(null, t);
  var nDense = 1000;
  var logMin = Math.log10(tMin);
  var logMax = Math.log10(tMax);
  var tDense = new Array(nDense);
  var vDense = new Array(nDense);
  for (var i = 0; i < nDense; i++) {
    tDense[i] = Math.pow(10, logMin + (logMax - logMin) * i / (nDense - 1));
    vDense[i] = LM.doubleExpModel([A1, tau1, A2, tau2, y0], tDense[i]);
  }

  // Step 3: Compute E_t and N_t
  var d_m = d_um * 1e-6;
  var C_factor = (EPS_0 * eps_r) / (E_CHARGE * d_m);

  var E_t = new Array(nDense);
  var N_t = new Array(nDense);
  for (var i = 0; i < nDense; i++) {
    E_t[i] = K_B * T * Math.log(nu * tDense[i]);
    var dVdlnT = analyticDerivative(tDense[i], A1, tau1, A2, tau2);
    N_t[i] = C_factor * Math.abs(dVdlnT);
  }

  // Step 4: Find peaks in N_t vs E_t
  var maxNt = Math.max.apply(null, N_t);
  var shallow_E = null, shallow_N = null, deep_E = null, deep_N = null;

  if (maxNt > 0) {
    var peaks = Peaks.findPeaks(N_t, { prominence: maxNt * 0.01, distance: 3 });
    if (peaks.length > 0) {
      // Sort peaks by E_t (energy)
      peaks.sort(function(a, b) { return E_t[a.index] - E_t[b.index]; });
      var peakEs = peaks.map(function(p) { return E_t[p.index]; });
      var peakNs = peaks.map(function(p) { return N_t[p.index]; });

      if (peaks.length >= 2) {
        shallow_E = peakEs[0]; shallow_N = peakNs[0];
        deep_E = peakEs[peakEs.length - 1]; deep_N = peakNs[peakEs.length - 1];
      } else {
        if (peakEs[0] < 0.90) {
          shallow_E = peakEs[0]; shallow_N = peakNs[0];
        } else {
          deep_E = peakEs[0]; deep_N = peakNs[0];
        }
      }
    }
  }

  // Step 5: Generate log-transformed data for plotting
  var tLog = t.map(function(x) { return Math.log10(x); });
  var tLogDense = tDense.map(function(x) { return Math.log10(x); });

  return {
    r2: r2, v0: v0,
    A1: A1, tau1: tau1, A2: A2, tau2: tau2, y0: y0,
    shallow_E: shallow_E, shallow_N: shallow_N,
    deep_E: deep_E, deep_N: deep_N,
    tDense: tDense, vDense: vDense,
    E_t: E_t, N_t: N_t,
    tLog: tLog, vRaw: v,
    tLogDense: tLogDense,
    maxNt: maxNt
  };
}

return {
  K_B: K_B,
  EPS_0: EPS_0,
  E_CHARGE: E_CHARGE,
  compute: compute
};

})();

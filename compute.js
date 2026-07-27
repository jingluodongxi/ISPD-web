// ISPD Computation Engine
var ISPD = (function() {
"use strict";

var K_B = 8.617e-5;
var EPS_0 = 8.854e-12;
var E_CHARGE = 1.602e-19;
var EXTRAPOLATION_START_SECONDS = 5;

function assertValidSeries(t, v) {
  if (!Array.isArray(t) || !Array.isArray(v) || t.length !== v.length || t.length < 3) {
    throw new Error("时间与电位数据必须一一对应，且至少包含 3 个有效数据点。");
  }

  for (var i = 0; i < t.length; i++) {
    if (!isFinite(t[i]) || t[i] <= 0) {
      throw new Error("时间必须全部大于 0 s；第 " + (i + 1) + " 个有效时间为 " + t[i] + "。");
    }
    if (!isFinite(v[i])) {
      throw new Error("电位必须为有限数值；第 " + (i + 1) + " 个有效电位无效。");
    }
    if (i > 0 && t[i] <= t[i - 1]) {
      throw new Error("时间必须严格递增，不允许重复或倒序；请检查 " + t[i - 1] + " s 与 " + t[i] + " s。");
    }
  }
}

function logspace(start, end, count) {
  if (start === end) return [start];
  var values = new Array(count);
  var logStart = Math.log10(start);
  var logEnd = Math.log10(end);
  for (var i = 0; i < count; i++) {
    values[i] = Math.pow(10, logStart + (logEnd - logStart) * i / (count - 1));
  }
  return values;
}

function compute(t, v, T, nu, eps_r, d_um) {
  assertValidSeries(t, v);

  T = T || 300;
  nu = nu || 1e12;
  eps_r = eps_r || 3.0;
  d_um = d_um || 50;

  var tFirst = t[0];
  var tLast = t[t.length - 1];

  // Step 1: double-exponential fit (unchanged model).
  var vDrop = v[0] - v[v.length - 1];
  var tRange = tLast - tFirst;
  var fit = LM.fitDoubleExponential(t, v, vDrop, tRange);
  var A1 = fit.A1;
  var tau1 = fit.tau1;
  var A2 = fit.A2;
  var tau2 = fit.tau2;
  var y0 = fit.y0;
  var displayStart = Math.max(1e-9, Math.min(
    EXTRAPOLATION_START_SECONDS, tau1, tau2
  ));
  var displayEnd = Math.max(tLast, tau1, tau2);

  // Step 2: fitted V-t curve is kept inside the measured time interval.
  var tMeasured = logspace(tFirst, tLast, 1000);
  var vMeasured = tMeasured.map(function(time) {
    return voltageAt(time, A1, tau1, A2, tau2, y0);
  });

  // Step 3: E_t and N_t. Pre- and post-measurement portions are separate
  // model-extrapolation series so the chart can draw both as dashed lines.
  var d_m = d_um * 1e-6;
  var densityConstant = (EPS_0 * eps_r) / (E_CHARGE * d_m);
  var tPreExtrapolated = displayStart < tFirst ?
    logspace(displayStart, tFirst, 320) : [];
  var tPostExtrapolated = displayEnd > tLast ?
    logspace(tLast, displayEnd, 320) : [];
  var measuredTrap = trapSeries(tMeasured, T, nu, densityConstant, A1, tau1, A2, tau2);
  var preExtrapolatedTrap = trapSeries(
    tPreExtrapolated, T, nu, densityConstant, A1, tau1, A2, tau2
  );
  var postExtrapolatedTrap = trapSeries(
    tPostExtrapolated, T, nu, densityConstant, A1, tau1, A2, tau2
  );

  // Step 4: component peak energies are calculated directly from tau.
  // Peak density is evaluated analytically at the same time, not snapped
  // to the nearest displayed point.
  var shallowE = energyAt(tau1, T, nu);
  var deepE = energyAt(tau2, T, nu);
  var shallowN = densityAt(tau1, densityConstant, A1, tau1, A2, tau2);
  var deepN = densityAt(tau2, densityConstant, A1, tau1, A2, tau2);
  var shallowRegion = peakRegion(tau1, tFirst, tLast);
  var deepRegion = peakRegion(tau2, tFirst, tLast);

  // Reconstruct the fit bounds used by lmfit.js so boundary-constrained
  // components can be clearly flagged in the result table and CSV.
  var vEnd = v[v.length - 1];
  var vMax = Math.max.apply(null, v);
  var tauMin = 1;
  var tauMax = 20 * (tLast - tFirst);
  var amplitudeMax = 5 * Math.max(vMax - vEnd, v[0], 0.01);
  var y0Min = vEnd * 0.5;
  var y0Max = vEnd + (vMax - vEnd) * 2;
  var y0AtBoundary = nearBound(y0, y0Min, y0Max);
  var shallowBoundaryWarning =
    nearBound(A1, 0, amplitudeMax) ||
    nearBound(tau1, tauMin, tauMax) ||
    y0AtBoundary;
  var deepBoundaryWarning =
    nearBound(A2, 0, amplitudeMax) ||
    nearBound(tau2, tauMin, tauMax) ||
    y0AtBoundary;

  var combinedE = preExtrapolatedTrap.E
    .concat(measuredTrap.E, postExtrapolatedTrap.E);
  var combinedN = preExtrapolatedTrap.N
    .concat(measuredTrap.N, postExtrapolatedTrap.N);
  var maxNt = Math.max.apply(null, combinedN.concat([shallowN, deepN]));

  function safeFinite(x, fallback) {
    return isFinite(x) && x !== null ? x : fallback;
  }

  return {
    r2: safeFinite(fit.r2, 0),
    v0: safeFinite(v[0], 0),
    A1: safeFinite(A1, 0),
    tau1: safeFinite(tau1, 1),
    A2: safeFinite(A2, 0),
    tau2: safeFinite(tau2, 1),
    y0: safeFinite(y0, 0),
    tFirst: tFirst,
    tLast: tLast,
    displayStart: displayStart,
    displayEnd: displayEnd,
    shallow_E: safeFinite(shallowE, null),
    shallow_N: safeFinite(shallowN, null),
    shallow_peak_region: shallowRegion,
    shallow_boundary_warning: shallowBoundaryWarning,
    shallow_extrapolated: shallowRegion !== "measured",
    deep_E: safeFinite(deepE, null),
    deep_N: safeFinite(deepN, null),
    deep_peak_region: deepRegion,
    deep_boundary_warning: deepBoundaryWarning,
    deep_extrapolated: deepRegion !== "measured",
    EMeasured: measuredTrap.E,
    NMeasured: measuredTrap.N,
    EPreExtrapolated: preExtrapolatedTrap.E,
    NPreExtrapolated: preExtrapolatedTrap.N,
    EPostExtrapolated: postExtrapolatedTrap.E,
    NPostExtrapolated: postExtrapolatedTrap.N,
    // Previous names remain aliases for the pre-measurement segment.
    EExtrapolated: preExtrapolatedTrap.E,
    NExtrapolated: preExtrapolatedTrap.N,
    // Retained for compatibility with existing consumers and exports.
    E_t: combinedE,
    N_t: combinedN,
    tDense: tMeasured,
    vDense: vMeasured,
    tLog: t.map(function(x) { return Math.log10(x); }),
    vRaw: v,
    tLogDense: tMeasured.map(function(x) { return Math.log10(x); }),
    maxNt: safeFinite(maxNt, 0)
  };
}

function peakRegion(tau, tFirst, tLast) {
  if (tau < tFirst) return "before";
  if (tau > tLast) return "after";
  return "measured";
}

function nearBound(value, lower, upper) {
  var tolerance = Math.max(1e-8, Math.abs(upper - lower) * 1e-7);
  return Math.abs(value - lower) <= tolerance ||
    Math.abs(value - upper) <= tolerance;
}

function voltageAt(t, A1, tau1, A2, tau2, y0) {
  return A1 * Math.exp(-t / tau1) + A2 * Math.exp(-t / tau2) + y0;
}

function energyAt(t, T, nu) {
  return K_B * T * Math.log(nu * t);
}

function densityAt(t, densityConstant, A1, tau1, A2, tau2) {
  var dV = -(A1 / tau1) * Math.exp(-t / tau1) -
    (A2 / tau2) * Math.exp(-t / tau2);
  return densityConstant * Math.abs(t * dV);
}

function trapSeries(times, T, nu, densityConstant, A1, tau1, A2, tau2) {
  return {
    E: times.map(function(t) { return energyAt(t, T, nu); }),
    N: times.map(function(t) {
      return densityAt(t, densityConstant, A1, tau1, A2, tau2);
    })
  };
}

return {
  compute: compute,
  EXTRAPOLATION_START_SECONDS: EXTRAPOLATION_START_SECONDS
};
})();

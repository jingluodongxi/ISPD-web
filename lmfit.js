// ISPD LM Fitting Engine — enhanced with more initial guesses
var LM = (function() {
'use strict';

function zeros(r, c) { var m = new Array(r); for (var i = 0; i < r; i++) { m[i] = new Array(c); for (var j = 0; j < c; j++) m[i][j] = 0; } return m; }
function transpose(A) { var r = A.length, c = A[0].length, T = zeros(c, r); for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) T[j][i] = A[i][j]; return T; }
function matMul(A, B) { var aR = A.length, aC = A[0].length, bC = B[0].length, C = zeros(aR, bC); for (var i = 0; i < aR; i++) for (var k = 0; k < aC; k++) if (A[i][k] !== 0) for (var j = 0; j < bC; j++) C[i][j] += A[i][k] * B[k][j]; return C; }

function solve(A, b) {
  var n = A.length, aug = new Array(n);
  for (var i = 0; i < n; i++) { aug[i] = new Array(n + 1); for (var j = 0; j < n; j++) aug[i][j] = A[i][j]; aug[i][n] = Array.isArray(b[i]) ? b[i][0] : b[i]; }
  for (var col = 0; col < n; col++) {
    var maxVal = Math.abs(aug[col][col]), maxRow = col;
    for (var row = col + 1; row < n; row++) { if (Math.abs(aug[row][col]) > maxVal) { maxVal = Math.abs(aug[row][col]); maxRow = row; } }
    if (maxVal < 1e-30) continue;
    var tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
    for (var row = col + 1; row < n; row++) { var f = aug[row][col] / aug[col][col]; for (var j = col; j <= n; j++) aug[row][j] -= f * aug[col][j]; }
  }
  var x = new Array(n);
  for (var i = n - 1; i >= 0; i--) { x[i] = aug[i][n]; for (var j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j]; x[i] /= (Math.abs(aug[i][i]) > 1e-30) ? aug[i][i] : 1; }
  return x;
}

function lmFit(modelFn, jacFn, xData, yData, p0, opts) {
  opts = opts || {};
  var maxIter = opts.maxIter || 300, lambda = opts.lambda0 || 1e-2;
  var ftol = opts.ftol || 1e-12, xtol = opts.xtol || 1e-12;
  var lambdaUp = 10, lambdaDown = 10;
  var n = xData.length, m = p0.length;
  var params = p0.slice();
  var cost = 0;
  for (var i = 0; i < n; i++) { var r = yData[i] - modelFn(params, xData[i]); cost += r * r; }
  cost /= n;
  for (var iter = 0; iter < maxIter; iter++) {
    var J = zeros(n, m), r = zeros(n, 1);
    for (var i = 0; i < n; i++) {
      var jr = jacFn(params, xData[i]), yp = modelFn(params, xData[i]);
      r[i][0] = yData[i] - yp;
      for (var j = 0; j < m; j++) J[i][j] = jr[j];
    }
    var JT = transpose(J), JTJ = matMul(JT, J), JTr = matMul(JT, r);
    var A = zeros(m, m);
    for (var j = 0; j < m; j++) { for (var k = 0; k < m; k++) A[j][k] = JTJ[j][k]; A[j][j] += lambda * Math.max(JTJ[j][j], 1e-6); }
    var dp = solve(A, JTr);
    var maxDp = 0; for (var j = 0; j < m; j++) maxDp = Math.max(maxDp, Math.abs(dp[j]));
    var newParams = new Array(m); for (var j = 0; j < m; j++) newParams[j] = params[j] + dp[j];
    var newCost = 0;
    for (var i = 0; i < n; i++) { var nr = yData[i] - modelFn(newParams, xData[i]); if (!isFinite(nr)) { newCost = Infinity; break; } newCost += nr * nr; }
    newCost /= n;
    if (newCost < cost && isFinite(newCost)) { lambda /= lambdaDown; cost = newCost; params = newParams; if (maxDp < xtol) break; }
    else { lambda *= lambdaUp; }
  }
  return { params: params, success: true, iterations: maxIter, cost: cost };
}

function doubleExpModel(params, t) {
  var A1 = params[0], tau1 = Math.max(Math.abs(params[1]), 0.1);
  var A2 = params[2], tau2 = Math.max(Math.abs(params[3]), 0.1);
  var y0 = params[4];
  return A1 * Math.exp(-t / tau1) + A2 * Math.exp(-t / tau2) + y0;
}

function doubleExpJacobian(params, t) {
  var A1 = params[0], tau1 = Math.max(Math.abs(params[1]), 0.1);
  var A2 = params[2], tau2 = Math.max(Math.abs(params[3]), 0.1);
  var e1 = Math.exp(-t / tau1), e2 = Math.exp(-t / tau2);
  return [e1, A1 * (t / (tau1 * tau1)) * e1, e2, A2 * (t / (tau2 * tau2)) * e2, 1];
}

function fitDoubleExponential(t, v, vDrop, tRange) {
  vDrop = vDrop || (v[0] - v[v.length - 1]);
  tRange = tRange || (t[t.length - 1] - t[0]);
  var vMax = Math.max.apply(null, v);
  var vEnd = v[v.length - 1];
  var vStart = v[0];

  // Multiple initial guess strategies — both vDrop-based (original) and vMax-based (Python style)
  var p0Sets = [
    // Original vDrop-based
    [vDrop * 0.6, tRange * 0.1, vDrop * 0.3, tRange * 0.5, vEnd],
    [vDrop * 0.5, tRange * 0.05, vDrop * 0.4, tRange * 0.3, vEnd],
    [vDrop * 0.7, tRange * 0.15, vDrop * 0.2, tRange * 0.8, vEnd],
    [vDrop * 0.4, tRange * 0.02, vDrop * 0.5, tRange * 0.2, vEnd],
    [vDrop * 0.3, tRange * 0.08, vDrop * 0.6, tRange * 0.6, vEnd],
    // Python-style vMax-based
    [vMax*0.5, 30, vMax*0.5, 800, vEnd],
    [vMax*0.4, 80, vMax*0.6, 2000, vEnd],
    [vMax*0.6, 50, vMax*0.4, 1200, vEnd*0.9],
    [vMax*0.5, 50, vMax*0.5, 1000, vEnd],
  ];

  var tauMax = 20 * tRange;
  var AMax = 5 * Math.max(vDrop, vStart, 0.01);

  var bestResult = null;
  var bestCost = Infinity;
  var bestPopt = null;

  for (var k = 0; k < p0Sets.length; k++) {
    try {
      var result = lmFit(doubleExpModel, doubleExpJacobian, t, v, p0Sets[k], {
        maxIter: 300, lambda0: 1e-2, ftol: 1e-14, xtol: 1e-14
      });
      if (result.cost < bestCost && isFinite(result.cost)) {
        bestCost = result.cost;
        bestResult = result;
        bestPopt = result.params.slice();
      }
    } catch(e) {}
  }

  if (!bestResult) {
    bestPopt = p0Sets[0].slice();
    bestResult = { params: bestPopt, success: false, iterations: 0, cost: 0 };
  }

  // Clamp parameters
  var p = bestPopt;
  var A1 = Math.max(0, Math.min(p[0], AMax));
  var tau1 = Math.max(0.1, Math.min(Math.abs(p[1]), tauMax));
  var A2 = Math.max(0, Math.min(p[2], AMax));
  var tau2 = Math.max(0.1, Math.min(Math.abs(p[3]), tauMax));
  var y0 = Math.max(vEnd - vDrop*2, Math.min(p[4], vEnd + vDrop*2));

  // Ensure fast component first (tau1 <= tau2)
  if (tau1 > tau2) {
    var tmpA = A1, tmpTau = tau1;
    A1 = A2; tau1 = tau2;
    A2 = tmpA; tau2 = tmpTau;
  }

  // Compute R-squared
  var ssRes = 0, ssTot = 0, vMean = 0;
  for (var i = 0; i < v.length; i++) vMean += v[i];
  vMean /= v.length;
  for (var i = 0; i < v.length; i++) {
    var pred = A1 * Math.exp(-t[i] / tau1) + A2 * Math.exp(-t[i] / tau2) + y0;
    var resid = v[i] - pred;
    ssRes += resid * resid;
    var dev = v[i] - vMean;
    ssTot += dev * dev;
  }
  var r2 = Math.max(0, 1 - ssRes / (ssTot || 1));

  return { A1: A1, tau1: tau1, A2: A2, tau2: tau2, y0: y0, r2: r2, success: bestResult.success };
}

return {
  lmFit: lmFit,
  doubleExpModel: doubleExpModel,
  doubleExpJacobian: doubleExpJacobian,
  fitDoubleExponential: fitDoubleExponential
};

})();

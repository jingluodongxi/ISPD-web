// Levenberg-Marquardt nonlinear least squares curve fitting
// Ported from scipy.optimize.curve_fit logic

var LM = (function() {
'use strict';

// ========================
// Matrix utilities
// ========================
function zeros(rows, cols) {
  var m = new Array(rows);
  for (var i = 0; i < rows; i++) {
    m[i] = new Array(cols);
    for (var j = 0; j < cols; j++) m[i][j] = 0;
  }
  return m;
}

function transpose(A) {
  var rows = A.length, cols = A[0].length;
  var T = zeros(cols, rows);
  for (var i = 0; i < rows; i++)
    for (var j = 0; j < cols; j++)
      T[j][i] = A[i][j];
  return T;
}

function matMul(A, B) {
  var aRows = A.length, aCols = A[0].length;
  var bCols = B[0].length;
  var C = zeros(aRows, bCols);
  for (var i = 0; i < aRows; i++)
    for (var k = 0; k < aCols; k++)
      if (A[i][k] !== 0)
        for (var j = 0; j < bCols; j++)
          C[i][j] += A[i][k] * B[k][j];
  return C;
}

// Solve A*x = b using Gaussian elimination with partial pivoting
function solve(A, b) {
  var n = A.length;
  var aug = new Array(n);
  for (var i = 0; i < n; i++) {
    aug[i] = new Array(n + 1);
    for (var j = 0; j < n; j++) aug[i][j] = A[i][j];
    aug[i][n] = (Array.isArray(b[i])) ? b[i][0] : b[i];
  }

  for (var col = 0; col < n; col++) {
    var maxVal = Math.abs(aug[col][col]);
    var maxRow = col;
    for (var row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-30) continue;

    var tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;

    for (var row = col + 1; row < n; row++) {
      var factor = aug[row][col] / aug[col][col];
      for (var j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  var x = new Array(n);
  for (var i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (var j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= (Math.abs(aug[i][i]) > 1e-30) ? aug[i][i] : 1;
  }
  return x;
}

// ========================
// LM Algorithm
// ========================
function lmFit(modelFn, jacFn, xData, yData, p0, options) {
  options = options || {};
  var maxIter = options.maxIter || 200;
  var lambda = options.lambda0 || 1e-2;
  var ftol = options.ftol || 1e-12;
  var xtol = options.xtol || 1e-12;
  var lambdaUp = 10, lambdaDown = 10;

  var n = xData.length;
  var m = p0.length;
  var params = p0.slice();

  var cost = 0;
  for (var i = 0; i < n; i++) {
    var r = yData[i] - modelFn(params, xData[i]);
    cost += r * r;
  }
  cost /= n;

  for (var iter = 0; iter < maxIter; iter++) {
    var J = zeros(n, m);
    var r = zeros(n, 1);
    for (var i = 0; i < n; i++) {
      var jacRow = jacFn(params, xData[i]);
      var yPred = modelFn(params, xData[i]);
      r[i][0] = yData[i] - yPred;
      for (var j = 0; j < m; j++) {
        J[i][j] = jacRow[j];
      }
    }

    var JT = transpose(J);
    var JTJ = matMul(JT, J);
    var JTr = matMul(JT, r);

    var A = zeros(m, m);
    for (var j = 0; j < m; j++) {
      for (var k = 0; k < m; k++) {
        A[j][k] = JTJ[j][k];
      }
      A[j][j] += lambda * Math.max(JTJ[j][j], 1e-6);
    }

    var dp = solve(A, JTr);

    var maxDp = 0;
    for (var j = 0; j < m; j++) maxDp = Math.max(maxDp, Math.abs(dp[j]));

    var newParams = new Array(m);
    for (var j = 0; j < m; j++) newParams[j] = params[j] + dp[j];

    var newCost = 0;
    for (var i = 0; i < n; i++) {
      var nr = yData[i] - modelFn(newParams, xData[i]);
      if (!isFinite(nr)) { newCost = Infinity; break; }
      newCost += nr * nr;
    }
    newCost /= n;

    if (newCost < cost && isFinite(newCost)) {
      lambda /= lambdaDown;
      cost = newCost;
      params = newParams;
      if (maxDp < xtol) {
        return { params: params, success: true, iterations: iter + 1, cost: cost };
      }
    } else {
      lambda *= lambdaUp;
    }
  }

  return { params: params, success: false, iterations: maxIter, cost: cost };
}

// Double exponential model: f(t) = A1*exp(-t/tau1) + A2*exp(-t/tau2) + y0
function doubleExpModel(params, t) {
  var A1 = params[0], tau1 = Math.max(Math.abs(params[1]), 0.1);
  var A2 = params[2], tau2 = Math.max(Math.abs(params[3]), 0.1);
  var y0 = params[4];
  return A1 * Math.exp(-t / tau1) + A2 * Math.exp(-t / tau2) + y0;
}

function doubleExpJacobian(params, t) {
  var A1 = params[0], tau1 = Math.max(Math.abs(params[1]), 0.1);
  var A2 = params[2], tau2 = Math.max(Math.abs(params[3]), 0.1);
  var e1 = Math.exp(-t / tau1);
  var e2 = Math.exp(-t / tau2);
  return [
    e1,
    A1 * (t / (tau1 * tau1)) * e1,
    e2,
    A2 * (t / (tau2 * tau2)) * e2,
    1
  ];
}

function fitDoubleExponential(t, v, vDrop, tRange) {
  // Classic double-exponential fit with simple wide bounds (like Python original)
  vDrop = vDrop || (v[0] - v[v.length - 1]);
  tRange = tRange || (t[t.length - 1] - t[0]);
  var vMax = Math.max.apply(null, v);
  var vEnd = v[v.length - 1];
  var vStart = v[0];

  var p0Sets = [
    [vMax*0.5, 30,   vMax*0.5, 800,  0],
    [vMax*0.4, 80,   vMax*0.6, 2000, vEnd*0.5],
    [vMax*0.6, 50,   vMax*0.4, 1200, 0],
    [vMax*0.5, 50,   vMax*0.5, 1000, 0],
  ];

  // Wide bounds: only require positivity, let the fit find the right values
  var tauMax = 100 * tRange;
  var AMax = 20 * Math.max(vDrop, vStart, 0.01);

  var bestResult = null;
  var bestCost = Infinity;

  for (var k = 0; k < p0Sets.length; k++) {
    try {
      var result = lmFit(doubleExpModel, doubleExpJacobian, t, v, p0Sets[k], {
        maxIter: 300, lambda0: 1e-2, ftol: 1e-14, xtol: 1e-14
      });
      if (result.cost < bestCost && isFinite(result.cost)) {
        bestCost = result.cost;
        bestResult = result;
      }
    } catch(e) {}
  }

  if (!bestResult) {
    var p = p0Sets[0].slice();
    bestResult = { params: p, success: false, iterations: 0, cost: 0 };
  }

  // Clamp parameters to physically reasonable ranges
  var p = bestResult.params;
  var A1 = Math.max(0, Math.min(p[0], AMax));
  var tau1 = Math.max(0.1, Math.min(Math.abs(p[1]), tauMax));
  var A2 = Math.max(0, Math.min(p[2], AMax));
  var tau2 = Math.max(0.1, Math.min(Math.abs(p[3]), tauMax));
  var y0 = Math.max(vEnd - vDrop*2, Math.min(p[4], vEnd + vDrop*2));

  // Ensure tau2 > tau1 (fast component first)
  if (tau1 > tau2) {
    var tmpA = A1, tmpTau = tau1;
    A1 = A2; tau1 = tau2;
    A2 = tmpA; tau2 = tmpTau;
  }

  // Compute R-squared
  var ssRes = 0, ssTot = 0;
  var vMean = 0;
  for (var i = 0; i < v.length; i++) vMean += v[i];
  vMean /= v.length;
  for (var i = 0; i < v.length; i++) {
    var pred = doubleExpModel([A1, tau1, A2, tau2, y0], t[i]);
    var resid = v[i] - pred;
    ssRes += resid * resid;
    var dev = v[i] - vMean;
    ssTot += dev * dev;
  }
  var r2 = Math.max(0, 1 - ssRes / (ssTot || 1));

  return { A1: A1, tau1: tau1, A2: A2, tau2: tau2, y0: y0, r2: r2, success: bestResult.success };
};

return {
  lmFit: lmFit,
  doubleExpModel: doubleExpModel,
  doubleExpJacobian: doubleExpJacobian,
  fitDoubleExponential: fitDoubleExponential
};

})();

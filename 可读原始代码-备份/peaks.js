// Peak finding with prominence (ported from scipy.signal.find_peaks)
var Peaks = (function() {
'use strict';

// Find local maxima with minimum distance constraint
function findLocalMaxima(y, distance) {
  distance = distance || 1;
  var peaks = [];
  var n = y.length;
  for (var i = 1; i < n - 1; i++) {
    if (y[i] > y[i-1] && y[i] > y[i+1]) {
      peaks.push(i);
    }
  }
  // Filter by minimum distance (keep higher peak when too close)
  if (distance > 1 && peaks.length > 0) {
    var filtered = [peaks[0]];
    for (var k = 1; k < peaks.length; k++) {
      if (peaks[k] - filtered[filtered.length-1] >= distance) {
        filtered.push(peaks[k]);
      } else if (y[peaks[k]] > y[filtered[filtered.length-1]]) {
        filtered[filtered.length-1] = peaks[k];
      }
    }
    peaks = filtered;
  }
  return peaks;
}

// Calculate prominence for each peak
// Prominence = peak height - height of lowest contour encircling only this peak
function calcProminence(y, peakIdx) {
  var n = y.length;
  var peakVal = y[peakIdx];

  // Walk left to find higher point or boundary
  var leftMin = peakVal;
  var leftEnd = 0;
  for (var j = peakIdx - 1; j >= 0; j--) {
    leftMin = Math.min(leftMin, y[j]);
    if (y[j] > peakVal) { leftEnd = j; break; }
  }

  // Walk right to find higher point or boundary
  var rightMin = peakVal;
  var rightEnd = n - 1;
  for (var j = peakIdx + 1; j < n; j++) {
    rightMin = Math.min(rightMin, y[j]);
    if (y[j] > peakVal) { rightEnd = j; break; }
  }

  // Prominence is peak height minus the higher of left and right minima
  var refLevel = Math.max(leftMin, rightMin);
  return peakVal - refLevel;
}

// Main find_peaks function
// y: array of values
// options: { prominence (threshold), distance (min spacing) }
function findPeaks(y, options) {
  options = options || {};
  var prominence = options.prominence || 0;
  var distance = options.distance || 1;

  // Step 1: find local maxima
  var candidates = findLocalMaxima(y, distance);

  // Step 2: calculate prominence and filter
  var result = [];
  for (var k = 0; k < candidates.length; k++) {
    var idx = candidates[k];
    var prom = calcProminence(y, idx);
    if (prom >= prominence) {
      result.push({ index: idx, value: y[idx], prominence: prom });
    }
  }

  return result;
}

return { findPeaks: findPeaks };

})();

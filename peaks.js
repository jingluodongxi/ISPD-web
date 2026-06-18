var Peaks = (function() {
'use strict';
function findLocalMaxima(y, distance) {
 distance = distance || 1;
 var peaks = [];
 var n = y.length;
 for (var i = 1; i < n - 1; i++) {
 if (y[i] > y[i-1] && y[i] > y[i+1]) {
 peaks.push(i);
 }
 }
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
function calcProminence(y, peakIdx) {
 var n = y.length;
 var peakVal = y[peakIdx];
 var leftMin = peakVal;
 var leftEnd = 0;
 for (var j = peakIdx - 1; j >= 0; j--) {
 leftMin = Math.min(leftMin, y[j]);
 if (y[j] > peakVal) { leftEnd = j; break; }
 }
 var rightMin = peakVal;
 var rightEnd = n - 1;
 for (var j = peakIdx + 1; j < n; j++) {
 rightMin = Math.min(rightMin, y[j]);
 if (y[j] > peakVal) { rightEnd = j; break; }
 }
 var refLevel = Math.max(leftMin, rightMin);
 return peakVal - refLevel;
}
function findPeaks(y, options) {
 options = options || {};
 var prominence = options.prominence || 0;
 var distance = options.distance || 1;
 var candidates = findLocalMaxima(y, distance);
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
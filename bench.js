
var edt = require('./');

var size = 2048;
var values = new Float64Array(size * size);

for (var i = 0; i < size * size; i++) {
    values[i] = 1e20;
}

values[size * size / 2] = 0;

console.time('edt');
edt(values, size, size);
console.timeEnd('edt');

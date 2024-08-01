importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js');

self.onmessage = function(e) {
  const file = e.data;
  Papa.parse(file, {
    complete: function(results) {
      self.postMessage(results.data);
    }
  });
};
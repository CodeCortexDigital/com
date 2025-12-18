fetch('./header.html')
.then(r => r.text())
.then(d => document.getElementById('site-header').innerHTML = d);

fetch('./footer.html')
.then(r => r.text())
.then(d => document.getElementById('site-footer').innerHTML = d);

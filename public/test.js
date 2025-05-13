console.log('JavaScript está funcionando correctamente');

// Creamos un elemento para mostrar en la página
window.onload = function() {
  if (document.getElementById('js-test')) {
    document.getElementById('js-test').textContent = 'JavaScript está funcionando correctamente';
  }
}; 
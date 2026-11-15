const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../assets/scripts/muni360-import.js');

test('importación de padrón conserva categoría y tira, y permite tira vacía',()=>{
 const rows=[['Apellido','Nombre','DNI','Categoría','Tira'],['Pérez','Juan','12345678','Sub-12','A'],['Pérez','Juan','12345678','Sub-12','B'],['Gómez','Lucía','','Sub-14','']];
 assert.deepEqual(parse(rows),[
  {jugador:'Pérez, Juan',dni:'12345678',categoria:'Sub-12',equipo:'A'},
  {jugador:'Pérez, Juan',dni:'12345678',categoria:'Sub-12',equipo:'B'},
  {jugador:'Gómez, Lucía',dni:'',categoria:'Sub-14',equipo:''}
 ]);
});

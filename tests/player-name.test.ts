import test from 'node:test';
import assert from 'node:assert/strict';
import { playerName } from '../src/player-name.ts';

test('Google defaults use given name, or only the first full-name component', () => {
  assert.equal(playerName({given_name:'Maria Teresa',full_name:'Maria Teresa Rossi'}),'Maria Teresa');
  assert.equal(playerName({full_name:'  Amica\tRossi  '}),'Amica');
  assert.equal(playerName({name:'Élodie Dupont'}),'Élodie');
  assert.equal(playerName({full_name:'',name:'李 小明'}),'李');
});
test('chosen game names are preserved, bounded and independent of Google updates', () => {
  assert.equal(playerName({display_name:'  Luna  Blu ',given_name:'Amica',full_name:'Amica Rossi'}),'Luna Blu');
  assert.equal(playerName({display_name:' ',given_name:'Amica'}),'Amica');
  assert.equal(playerName({display_name:'x'.repeat(100)}).length,80);
  assert.equal(playerName({given_name:17,full_name:null,email:'private@example.test'}),'');
});

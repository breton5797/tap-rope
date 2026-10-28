// Office build entry (office.html): the v8 app, with the modules in build/office-swaps.ts swapped for src/office/.
import '../styles/main.css';
import './styles/office.css'; // office skin over the v8 styles
import { startApp } from '../game/app';

startApp();

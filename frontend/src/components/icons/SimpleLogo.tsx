import { createLucideIcon, type IconNode } from 'lucide-react';

//Original design viewbox 256 to lucide icons viewbox 24
const scale = `scale(${24/256})`;

const iconNode: IconNode = [
    ['path', { d: 'M65.65 92 A72 72 0 1 0 128 56', stroke: '#ff5a5f', strokeWidth: '20', transform: scale, key: 'arc' }],
    ['polygon', { points: '98,56 138,32 138,80', stroke: 'none', fill: '#ff5a5f', transform: scale, key: 'arrow' }],
    ['polygon', { points: '112,96 112,160 164,128', stroke: 'none', fill: 'currentColor', transform: scale, key: 'play' }],
];

export const SimpleLogo = createLucideIcon('simple-logo', iconNode);

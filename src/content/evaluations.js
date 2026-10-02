import planetary from '../../reports/planetary-evaluations.json';
import planetaryDownload from '../../reports/planetary-evaluations.json?url';

// Later reviews never rewrite the original generation metadata.
export const reviews = { planetary };
export const reviewDownloads = { planetary: planetaryDownload };

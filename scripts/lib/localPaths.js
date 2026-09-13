import { homedir } from 'node:os';
import { resolve } from 'node:path';

const configurationDirectory = resolve(homedir(), 'Desktop', 'Archivos organizados', 'Configuracion y datos');

export const externalConfigPath = filename => resolve(configurationDirectory, filename);

const role = process.env.FLY_ROLE ?? 'web';
if (role === 'web') await import('./index.js');
else if (role === 'indexer') await import('./indexer.js');
else throw new Error('INVALID_SERVICE_ROLE');

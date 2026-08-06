import { register } from 'node:module';
register('tsx', import.meta.url);
await import('/tmp/doctor.config.ts').then(m => console.log(JSON.stringify(m.default ?? m))).catch(e => console.log('err', e.message));

import { execSync } from 'child_process';
try {
    const stdout = execSync('git remote -v', { encoding: 'utf8' });
    console.log('STDOUT:', stdout);
} catch (e) {
    console.log('ERROR:', e.message);
    console.log('STDERR:', e.stderr?.toString() || 'none');
}

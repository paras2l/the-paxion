import fs from 'fs';
try {
    const branch = fs.readFileSync('branch_out.txt', 'utf8');
    const remote = fs.readFileSync('remote_out.txt', 'utf8');
    console.log('BRANCH:', branch);
    console.log('REMOTE:', remote);
} catch (e) {
    console.log('ERROR:', e.message);
}

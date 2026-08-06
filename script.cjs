const fs = require('fs');
const file = 'c:/Users/T470/Downloads/DataCustomer/customer-dashboard/src/pages/SettingsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/printMarginUnit\?: string;\s*}/, 'printMarginUnit?: string;\n  waApiUrl?: string;\n}');
content = content.replace(/const \[printCustomHeight, setPrintCustomHeight\] = useState\(settings\.printCustomHeight \|\| '297'\);/, 'const [printCustomHeight, setPrintCustomHeight] = useState(settings.printCustomHeight || \'297\');\n  const [waApiUrl, setWaApiUrl] = useState(settings.waApiUrl || \'http://localhost:3001\');');
content = content.replace(/printMarginTop,([\s\S]*?)printCustomWidth,([\s\S]*?)printCustomHeight,([\s\S]*?)printMarginUnit/g, 'printMarginTop,$1printCustomWidth,$2printCustomHeight,$3printMarginUnit,\n        waApiUrl');
content = content.replace(/setPrintCustomHeight\('297'\);/g, 'setPrintCustomHeight(\'297\');\n      setWaApiUrl(\'http://localhost:3001\');');

const newField = `                  <div className="form-group" style={{ marginTop: 18 }}>
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>URL Server WhatsApp (API)</label>
                    <div className="input-prefix-wrapper">
                      <input
                        type="text"
                        className="form-input-premium"
                        value={waApiUrl}
                        onChange={(e) => setWaApiUrl(e.target.value)}
                        placeholder="http://localhost:3001"
                      />
                    </div>
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                      Masukkan URL Ngrok/Tunnel jika ingin diakses dari luar. Biarkan default jika dari laptop.
                    </span>
                  </div>`;

content = content.replace(/<div className="mock-preview-container">/, newField + '\n\n                  <div className="mock-preview-container">');

fs.writeFileSync(file, content);
console.log('done');

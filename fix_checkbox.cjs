const fs = require('fs');
let code = fs.readFileSync('src/components/DayManagementModal.tsx', 'utf8');

const regex = /<button type="button"[\s\S]*?<\/label>/;

const replacement = `<button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (dayConfig.partyDeadline) {
                              onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: '' });
                            } else {
                              onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: \`\${selectedDayStr}T23:59\` });
                            }
                          }}
                          className="flex items-center gap-2 text-xs select-none p-2 rounded-lg bg-brand-bg/50 border border-brand-border hover:border-brand-primary/50 transition-all w-full text-left"
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                            dayConfig.partyDeadline ? "bg-brand-primary border-brand-primary text-brand-bg" : "bg-brand-bg border-brand-border"
                          )}>
                            {dayConfig.partyDeadline && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <span className="font-bold text-gray-300">Definir limite de envio para Festas/Eventos?</span>
                        </button>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/DayManagementModal.tsx', code);
  console.log("Replaced successfully!");
} else {
  console.log("Not found.");
}

const fs = require('fs');
let code = fs.readFileSync('src/components/DayManagementModal.tsx', 'utf8');

const target = `                    {/* Individual Deadline for Parties */}
                    {normalizedParties.length > 0 && (
                      <div className="pt-2 border-t border-brand-border/50">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none p-2 rounded-lg bg-brand-bg/50 border border-brand-border hover:border-brand-primary/50 transition-all">
                          <input 
                            type="checkbox"
                            checked={!!dayConfig.partyDeadline}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Default to 23:59 of the selected day
                                onUpdateDayConfig(selectedDayStr, { ...dayConfig, partyDeadline: \`\${selectedDayStr}T23:59\` });
                              } else {
                                const { partyDeadline, ...rest } = dayConfig;
                                onUpdateDayConfig(selectedDayStr, rest);
                              }
                            }}
                            className="rounded border-brand-border text-brand-primary bg-brand-bg focus:ring-brand-primary w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-bold text-gray-300">Definir limite de envio para Festas/Eventos?</span>
                        </label>
                        
                        {dayConfig.partyDeadline && (`;

const replacement = `                    {/* Individual Deadline for Parties */}
                    {normalizedParties.length > 0 && (
                      <div className="pt-2 border-t border-brand-border/50">
                        <button 
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
                        </button>
                        
                        {dayConfig.partyDeadline && (`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/DayManagementModal.tsx', code);
  console.log("Success exact match");
} else {
  // strip whitespace and do it
  let strippedCode = code.replace(/\s+/g, '');
  let strippedTarget = target.replace(/\s+/g, '');
  if (strippedCode.includes(strippedTarget)) {
     console.log("Found stripped match, but too complex to replace manually. I will use regex.");
  } else {
     console.log("Not found at all.");
  }
}

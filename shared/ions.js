/* Ion list shared by the iBond family of games (copied from iBond's index.html, Oct 2026).
 * Browser: <script src="../shared/ions.js"></script> makes window.IONS.  Node: require('./ions.js').
 * Each ion: s = symbol (digits become subscripts), c = charge, k = unique key (Fe2 and Fe3 share a symbol),
 *   cations: n = name (Roman numeral included for metals with more than one ion), tm = metal with more than one ion
 *   anions:  n = element name (monatomic only), ide = ion name
 *   poly = polyatomic ion
 */
(function (root) {
  const CATIONS = [
    {s:'Li',n:'lithium',c:1},{s:'Na',n:'sodium',c:1},{s:'K',n:'potassium',c:1},
    {s:'NH4',n:'ammonium',c:1,poly:true},
    {s:'Mg',n:'magnesium',c:2},{s:'Ca',n:'calcium',c:2},{s:'Sr',n:'strontium',c:2},{s:'Ba',n:'barium',c:2},
    {s:'Al',n:'aluminum',c:3,alt:['aluminium']},{s:'Ga',n:'gallium',c:3},
    {s:'Zn',n:'zinc',c:2},{s:'Ag',n:'silver',c:1},
    {s:'Cr',n:'chromium(III)',c:3,tm:'Cr'},{s:'Mn',n:'manganese(II)',c:2,tm:'Mn'},
    {s:'Fe',n:'iron(II)',c:2,tm:'Fe'},{s:'Fe',n:'iron(III)',c:3,tm:'Fe'},
    {s:'Co',n:'cobalt(II)',c:2,tm:'Co'},{s:'Co',n:'cobalt(III)',c:3,tm:'Co'},
    {s:'Ni',n:'nickel(II)',c:2,tm:'Ni'},
    {s:'Cu',n:'copper(I)',c:1,tm:'Cu'},{s:'Cu',n:'copper(II)',c:2,tm:'Cu'},
    {s:'Sn',n:'tin(II)',c:2,tm:'Sn'},{s:'Sn',n:'tin(IV)',c:4,tm:'Sn'},
    {s:'Pb',n:'lead(II)',c:2,tm:'Pb'},{s:'Pb',n:'lead(IV)',c:4,tm:'Pb'}
  ];
  const METAL = {Cr:'chromium',Mn:'manganese',Fe:'iron',Co:'cobalt',Ni:'nickel',Cu:'copper',Sn:'tin',Pb:'lead'};
  const ROM = ['','I','II','III','IV'];
  const ANIONS = [
    {s:'F',n:'fluorine',ide:'fluoride',c:-1},{s:'Cl',n:'chlorine',ide:'chloride',c:-1},
    {s:'Br',n:'bromine',ide:'bromide',c:-1},{s:'I',n:'iodine',ide:'iodide',c:-1},
    {s:'O',n:'oxygen',ide:'oxide',c:-2},{s:'S',n:'sulfur',ide:'sulfide',c:-2},{s:'Se',n:'selenium',ide:'selenide',c:-2},
    {s:'N',n:'nitrogen',ide:'nitride',c:-3},{s:'P',n:'phosphorus',ide:'phosphide',c:-3},
    {s:'OH',ide:'hydroxide',c:-1,poly:true},{s:'NO3',ide:'nitrate',c:-1,poly:true},{s:'NO2',ide:'nitrite',c:-1,poly:true},
    {s:'HCO3',ide:'bicarbonate',alt:['hydrogen carbonate'],c:-1,poly:true},
    {s:'C2H3O2',ide:'acetate',c:-1,poly:true},{s:'ClO3',ide:'chlorate',c:-1,poly:true},{s:'CN',ide:'cyanide',c:-1,poly:true},
    {s:'SCN',ide:'thiocyanate',c:-1,poly:true},
    {s:'SO4',ide:'sulfate',c:-2,poly:true},{s:'SO3',ide:'sulfite',c:-2,poly:true},{s:'CO3',ide:'carbonate',c:-2,poly:true},
    {s:'CrO4',ide:'chromate',c:-2,poly:true},
    {s:'PO4',ide:'phosphate',c:-3,poly:true}
  ];
  // the six polyatomic ions taught first; the rest are "advanced"
  const BASIC_POLY = ['NH4','OH','CO3','SO4','NO3','PO4'];
  // look-alike names students mix up (used for wrong answer choices)
  const NAME_TRAPS = {
    N:['nitrate','nitrite'], P:['phosphate','phosphite'], S:['sulfate','sulfite'], O:['hydroxide'], Cl:['chlorate'],
    NO3:['nitrite','nitride'], NO2:['nitrate','nitride'], SO4:['sulfite','sulfide'], SO3:['sulfate','sulfide'],
    PO4:['phosphite','phosphide'], CO3:['carbide','carbon trioxide'], OH:['oxide','hydride'],
    HCO3:['carbonate'], C2H3O2:['acetide','carbonate'], ClO3:['chloride','chlorite'], CN:['cyanate','carbide'],
    CrO4:['chromide','chromite'], SCN:['cyanide','thiocyanide']
  };
  const CAT_TRAPS = {NH4:['ammonia','nitrogen tetrahydride']};
  [...CATIONS, ...ANIONS].forEach(i => { i.k = i.tm ? i.s + i.c : i.s; });
  const BY_KEY = {};
  [...CATIONS, ...ANIONS].forEach(i => { BY_KEY[i.k] = i; });
  const IONS = {CATIONS, ANIONS, METAL, ROM, BASIC_POLY, NAME_TRAPS, CAT_TRAPS, BY_KEY};
  if (typeof module === 'object' && module.exports) module.exports = IONS;
  else root.IONS = IONS;
})(typeof window !== 'undefined' ? window : globalThis);

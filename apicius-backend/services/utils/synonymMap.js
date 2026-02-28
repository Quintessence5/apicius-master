const synonymGroups = {
  // canonical DB name : [ list of synonyms ]
  "chocolate 70% dark": [
    "dark chocolate 70%", "chocolate 70%","dark chocolate", "chocolate dark"
  ],
  "chocolate 50% dark": [
    "chocolate dark couverture", "chocolate couverture dark", "dark chocolate couverture", "dark chocolate 50%", "chocolate 50%", "chocolate bittersweet", "bittersweet chocolate", "chocolate bars", "chocolate bar","bar chocolate","bars chocolate"
  ],
  "cocoa powder unsweetened": [
    "bitter cocoa powder", "unsweetened cocoa powder", "cocoa unsweetened", "cocoa bitter", "bitter cocoa", "cocoa powder","powder cocoa"
  ],
  "Cream 30% fat": [
    "heavy whipping cream", "whipping cream","cream heavy whipping", "cream heavy", "heavy cream", "double cream", "full cream", "cream heavy"
  ],
  "sugar white": [
    "granulated sugar", "white sugar", "sugar granulated","caster sugar","castered sugar"
  ],
  "flour type 55": [
    "all purpose flour", "all-purpose flour", "plain flour", "flour all-purpose", "flour plain","flour",
  ],
  "oil vegetable": [
    "vegetable oil", "neutral vegetable","seed oil","neutral oil","oil neutral", "oil seeds"
  ]
};

// Build reverse map (synonym -> canonical)
const synonymMap = {};
for (const [canonical, synonyms] of Object.entries(synonymGroups)) {
  for (const syn of synonyms) {
    synonymMap[syn.toLowerCase().trim()] = canonical;
  }
}

module.exports = { synonymMap } ;
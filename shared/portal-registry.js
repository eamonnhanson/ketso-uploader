(function(root){
 const entries=[
 {id:'online',title:'Online Agroforestry Training',href:'/academy/online/',color:'#203A29',course:'online_tree_planting',description:'Online lessons, optional onboarding and tutor questions.'},
 {id:'distance',title:'Distance Certificate Course Agroforestry',href:'/academy/distance/',color:'#7D552C',course:'arboriculture_1',description:'Course modules and assignments.'},
 {id:'donors',title:'Communicate effectively with donors and investors',href:'/academy/donors/',color:'#CF6600',course:'donor_investor_funding',description:'Reports, proposals and business development.'},
 {id:'profile',title:'My profile and support requests',href:'/student-account/',color:'#547D60',description:'Your private writing, questions and staff feedback.'},
 {id:'staff',title:'KETSO staff login',href:'/staff-home/',color:'#414740',description:'Staff uploads and administration.'}
 ];
 const registry={entries,extraCourse:'https://forms.zohopublic.eu/greenmakombeh/form/KETSOAcademyEnrolinanothercourse/formperma/FWXOc5zBBvDexB4K15XxcJypcvSrt6CYM5mOSMe2Ipg',logo:'/assets/brand/ketso_logo_transparent_clean.png'};
 if(typeof module==='object')module.exports=registry;else root.KetsoPortal=registry;
})(typeof window==='object'?window:globalThis);

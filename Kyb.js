const mongoose = require('mongoose');

const KYBSchema = new mongoose.Schema({
    legal_name : {type: String, default: ''},
    legal_person_identifier : {type: String, default: ''},
    jurisdiction_code  : {type: String, default: ''},
    business_role : {type: String, default: ''},
    address : {type: String, default: ''},
    lei : {type: String, default: ''},
    vat_registration : {type: String, default: ''},
    birthdate : {type: String, default: ''},
    trading_status : {type: String, default: ''},
    given_name : {type: String, default: ''},
    family_name : {type: String, default: ''},
    sub_jurisdiction : {type: String, default: ''}
});

const Kyb = mongoose.model('Kyb', KYBSchema);

module.exports = Kyb;

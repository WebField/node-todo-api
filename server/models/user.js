const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

let UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        unique: true,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email'
        }
    },
    password: {
        type: String,
        require: true,
        minlength: 6
    },
    tokens: [{
        access: {
            type: String,
            required: true
        },
        token: {
            type: String,
            required: true
        }
    }]
});

UserSchema.methods.toJSON = function () {
    let user = this;
    let userObject = user.toObject();

    return _.pick(userObject, ['_id', 'email']);
};

UserSchema.methods.generateAuthToken = function () {
    let user = this;
    let access = 'auth';
    let token = jwt.sign({_id: user._id.toHexString(), access}, process.env.JWT_SECRET).toString();

    user.tokens.push({access, token});

    return user.save()
        .then(() => token)
};

UserSchema.methods.removeToken = function (token) {
    let user = this;

    return user.update({
        $pull: {
            tokens: {
                token
            }
        }
    })
};

UserSchema.statics.findByToken = function (token) {
    let user = this;
    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);

    } catch (e) {
        return Promise.reject();
    }

    return User.findOne({
        '_id': decoded._id,
        'tokens.token': token,
        'tokens.access': 'auth'
    });
};

UserSchema.statics.findByCredentials = function (email, password) {
    const user = this;

    return User.findOne({email})
        .then(user => {
            if (!user) {
                return Promise.reject();
            }

            return new Promise((resolve, reject) => {
                bcrypt.compare(password, user.password, (err, res) => {
                    if (res) {
                        console.log(res);
                        resolve(user);
                    }
                    else {
                        reject();
                    }

                });
            });
        });
};

UserSchema.pre('save', function (next) {
    let user = this;

    if (user.isModified('password')) {
        /**
         * First arguementis the number of rounds bcrypt should run. The higher the slower
         * The slower the more difficult it is to make brute force attacks.
         */
        bcrypt.genSalt(12, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash;
                next();
            });
        });
    }
    else {
        next();
    }
});

const User = mongoose.model('User', UserSchema);

module.exports = {User};

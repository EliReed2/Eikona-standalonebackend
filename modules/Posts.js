const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//Mostly same contents as the gallery item schema, however the post must include the username with it
const PostSchema = new Schema({
    name: {
        type: String,
        required: false,
    },
    location: {
        type: String,
        required: false,
    },
    coordinatesHolder: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
        }
    },
    timestamp: {
        type: String,
    },
    numTimestamp: {
        type: Number,
    },
    url: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
 },
    { timestamps: true});

// Create 2dsphere index on coordinatesHolder
PostSchema.index({ coordinatesHolder: '2dsphere' });

const Post = mongoose.model("PostColl", PostSchema);

module.exports = Post;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const GalleryItemSchema = new Schema({
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
    isPosted: {
        type: Boolean,
        required: true,
    }
});

//Define a 2dSphere index
GalleryItemSchema.index({ coordinatesHolder: '2dsphere'});

// Define the new schema that will hold an array of GalleryItems and an id
const GallerySchema = new Schema({
    userName: {
        type: String,
        required: true,
        unique: true, // Ensure that each Gallery has a unique userName
    },
    userPassword: {
        type: String,
        required: true,
    },
    galleryItems: [GalleryItemSchema], 
});

const Gallery = mongoose.model("Gallery", GallerySchema);

module.exports = Gallery;
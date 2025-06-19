const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
//Json Web Token
const jwt = require('jsonwebtoken');
//Bcrypt for hashing passwords
const bcrypt = require('bcrypt');


//Load .env file
require('dotenv').config();
//CONFIG PORT 
const PORT = process.env.PORT;

const MongoURL = process.env.MONGOURL;

const app = express();

app.use(cors());
app.use(express.json());

//Specified salt rounds for bcrypt
const saltRounds = process.env.SALTROUNDS;
//Secret Key used for send JWT
const secretKey = process.env.JWT_SECRETKEY;

//Connect to MongoDB Database
mongoose.connect(MongoURL)
    .then(() => console.log("Connected to MongoDB Database"))
    .catch(console.error);

//Connect to Gallery Schema
const Gallery = require('./modules/Gallery');
//Connect to Posts Schema
const Post = require("./modules/Posts");


//Function -> Ensures Server is running/responding
app.get("/", (req, res) => {
    res.send("Gallery API is running.");
});

//Function -> Attempts to sign user up (create them a gallery model in MongoDB)
app.post("/galleryitems/signup", async (req, res) => {
    //Store given username and password
    const userName = req.body.userName;
    const rawPassword = req.body.password;

    if (!userName || !rawPassword) {
        return res.status(400).json({ error: "Please provide both username and password." });
    }
    //Encrypt rawPassword using bcrypt (asynchronous hashing)
    const hashPassword = await bcrypt.hash(rawPassword, parseInt(saltRounds));
    //Ensure user does not already exist within the system
    let gallery = await Gallery.findOne({userName});
    if (!gallery) {
        //If no user exists, create one
        gallery = new Gallery({
            userName: userName,
            userPassword: hashPassword,
            galleryItems: [],
        });
        //Wait for this change to save
        await gallery.save();
        //Alert frontend
        res.json("Account Created!");
    } else {
        //Otherwise, inform user that they already have an account
        return res.status(409).json({
            error: "An account with that username already exists. Please log in or choose a different username."
        });
    }
});

//Function -> Attempts to log in using username and encrypted password
app.post("/galleryitems/login", async (req, res) => {
    console.log("reached");
    //Store username and password given 
    const userName = req.body.userName;
    const rawPassword = req.body.password;
    //Use username to find users Gallery Model from database
    let gallery = await Gallery.findOne({userName});
    //Make sure gallery was found
    if (!gallery || gallery == null) {
        //Alert frontend so user can try again/be redirected
        return res.status(401).json({
            error: "Invalid username or password. Please try again."
        });
    }
    try {
        //Compare given password to bcrypted password (asynchronous hashing)
        const isMatch = await bcrypt.compare(rawPassword, gallery.userPassword);

        if (isMatch) {
            //Generate JWT (Json Web Token) and send it back to the frontend
            const token = jwt.sign({
                userName: userName,
            }, secretKey, {expiresIn: '365d'});
            //Send key to user
            res.json(token);
        } else {
            return res.status(401).json({
                error: "Invalid username or password. Please try again."
            });
        }
    } catch (err) {
        return res.status(500).json({
            error: "A strange error occurred during login"
        });
    }
});
//Function -> Returns all GalleryItems in the database
app.get("/galleryitems", async (req, res) => {
    //Retrieve all Gallery models from MongoDB database
    const galleries = await Gallery.find();
    if (!galleries || galleries.length === 0) {
        return res.status(404).json({ message: "Gallery not found" });
    }
    //Extract all of the galleryItems 
    const galleryItems = galleries.flatMap(gallery => gallery.galleryItems);
    //Send to the main application
    res.json(galleryItems);
});

//Function -> Returns all GalleryItems in the database for a specific user
app.get("/galleryitems/:userName", async (req, res) => {
    const userName = req.params.userName;
    //Retrieve Users Gallery of Images
    const gallery = await Gallery.findOne({userName});
    if (!gallery) {
        return res.status(404).json({ message: "Gallery not found for this user" });
    }
    //Map all gallery items
    const galleryItems = gallery.galleryItems;
    //Return these gallery items to the user
    res.json(galleryItems);
});

//Function -> Adds an image to the specified users database
app.post("/galleryitems/add", async (req,res) => {
    console.log("Request", req.body);
    const userName = req.body.userName;
    const url = req.body.url;
    const name = req.body.name;
    const timestamp = req.body.timestamp;
    const location = req.body.location;
    const coordinatesHolder = req.body.coordinatesHolder;
    const numTimestamp = req.body.numTimestamp;
    const isPosted = req.body.isPosted;
    //Attempt to locate this users Gallery
    let gallery = await Gallery.findOne({userName});
    if (gallery == null) {
        //If user does not already have a gallery, omething wrong has occured as they shouldn't be logged in
        return res.status(404).json({ message: "Gallery not found for this user | Possible error occurred" });
    }
    //Create new galleryItem and add it to Gallery
    const newGalleryItem = ({
        name: name,
        location: location,
        coordinatesHolder: {
            type: 'Point',
            coordinates: coordinatesHolder.coordinates,
        },
        timestamp: timestamp,
        numTimestamp: numTimestamp,
        url: url,
        isPosted: isPosted,
    });
    //Push this new galleryItem to the galleryItems array
    gallery.galleryItems.push(newGalleryItem);

    //Wait for this change to save
    await gallery.save();
    res.status(200).json({ message: "Gallery item added successfully"});
});

//Function to remove a GalleryItem from a users MongoDB database, takes username and image name to identify image
app.delete('/galleryitems/delete/:username/:imgName', async (req,res) => {
    //Save variables from url command
    const userName = req.params.username;
    const imgName = req.params.imgName;
    //Attempt to locate and delete the image
    try {
        //Find user account
        const gallery = await Gallery.findOne({ userName: userName});
        //Check that gallery was found
        if (!gallery) {
            return res.status(404).json({message: "Gallery not found for this user | Possible error occured"});
        }

        //Filter out image within galleryItems array
        const originalLength = gallery.galleryItems.length;
        gallery.galleryItems = gallery.galleryItems.filter(item => item.name != imgName);

        //Ensure an item was removed
        if (gallery.galleryItems.length ==  originalLength) {
            return res.status(404).json({message: "Image could not be found within gallery"});
        }

        //Save updated gallery
        await gallery.save();
        //Return success
        res.status(200).json({message: "Image successfully removed"});
    } catch (error) {
        res.status(500).json({message: "An error occured while attempting to delete user image."});
    }
})

//Function -> Given post parameters, adds a post to the post schema DB
app.post("/post/add", async(req, res) => {
    //Retrieve information from call
    const {
        name,
        location,
        coordinatesHolder,
        timestamp,
        numTimestamp,
        url,
        username,
    } = req.body;

    try {
        //Push the contents of new post item to posts
        const newPost = new Post({
            name,
            location,
            coordinatesHolder: {
                type: 'Point',
                coordinates: coordinatesHolder.coordinates,
            },
            timestamp,
            numTimestamp,
            url,
            username,
        });
        //Save posts
        await newPost.save();

        //Find posts corresponding gallery image and set isPosted to true for that users gallery
        const userGallery = await Gallery.findOne({userName: username});

        if (!userGallery) {
            return res.status(404).json({ message: "Gallery not found for this user." });``
        }

        // Find and update the gallery item
        const item = userGallery.galleryItems.find(item => item.name === name);

        if (item) {
            item.isPosted = true;
            //Inform mongoose that user gallery has changed
            userGallery.markModified('galleryItems');
            await userGallery.save();
        } else {
            return res.status(404).json({ message: "Image not found in gallery." });
        }
        res.status(200).json({message: "Post successfully added to database"});
    } catch (error) {
        res.status(500).json({message: "Internal server error occured when attempting to add post"});
    };
});

//Function -> Retrieves posts from most recent, takes a given number of posts to return and is capable of realzing when MORE posts are requested if called again
app.get('/posts/recents', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit);
        const prevTime = req.query.prevTime;

        // Validate and parse prevTime
        let query = {};
        if (prevTime) {
            const timestamp = parseInt(prevTime); // Convert string to number
            const date = new Date(timestamp);     // Create Date object

            if (isNaN(date.getTime())) {
                return res.status(400).json({ error: "Invalid 'prevTime' timestamp" });
            }

            query = { createdAt: { $lt: date } };
        }

        // Fetch posts from the database
        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);

        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: "Error Pulling Most Recent Posts" });
    }
});


app.get('/post/all', async (req, res) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 }); 
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching all posts:', error);
    res.status(500).json({ error: 'Error fetching all posts' });
  }
});

//Function -> Similar to recents function, but retrieves posts based off of how nearby they were to the user
app.get('/posts/nearby', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const limit = parseInt(req.query.limit) || 20;
        const maxDistance = 400000000; // e.g., 10 km max distance, adjust as needed

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: "User latitude and longitude are required." });
        }

        const query = {
            "coordinatesHolder": {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat],  // LONGITUDE, LATITUDE order!
                    },
                    $maxDistance: maxDistance // in meters
                }
            }
        };

        const posts = await Post.find(query)
            .limit(limit);

        res.json(posts);
    } catch (error) {
        console.error("Nearby posts error:", error);
        res.status(500).json({ error: "Error pulling nearby posts", error });
    }
});


app.delete('/posts/delete/:username/:postName', async (req, res) => {
    const userName = req.params.username;
    const imgName = req.params.postName;

    try {
        // Attempt to find and delete the post
        const deletedPost = await Post.findOneAndDelete({
            username: userName,
            name: imgName,
        });

        if (!deletedPost) {
            return res.status(404).json({ message: "Post not found for this user." });
        }

        //If post has been found and deleted, set isPosted to false for that users gallery
        const userGallery = await Gallery.findOne({userName});

        if (!userGallery) {
            return res.status(404).json({ message: "Gallery not found for this user." });
        }

        // Find and update the gallery item
        const item = userGallery.galleryItems.find(item => item.name === imgName);

        if (item) {
            item.isPosted = false;
            await userGallery.save();
        } else {
            return res.status(404).json({ message: "Image not found in gallery." });
        }

        //Find item
        res.status(200).json({ message: "Post successfully deleted." });
    } catch (error) {
        console.error("Deletion error:", error);
        res.status(500).json({ message: "An error occurred while deleting the post." });
    }
});

//Function to validate JWT Auth Status
app.get('/auth/validate', async (req, res) => {
    try {
        //Try to get token from the Authorization header
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer "))  {
            return res.status(401).json({ message: "Missing or invalid token"});
        }

        const token = authHeader.split(" ")[1];

        //Attempt to verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);
        const user = await Gallery.findOne({ userName: decoded.userName });

        if (!user) {
        return res.status(401).json({ message: "User no longer exists" });
        }
        return res.status(200).json({ message: "Token is valid" });
    } catch (error) {
      console.error("Token validation error:", error);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
});

//Set Server to listen on specified port
app.listen(PORT, () => {
    console.log(`Server Listening on Port ${PORT}`);
});


const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
    limits: {
        fileSize: 100 *1024**2 // 100 MB
    }
});
const upload = multer({ storage });


// Serve index.html as the default file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



// Endpoint to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log(`File uploaded successfully: ${req.file.filename}`);
    res.sendStatus(200);
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
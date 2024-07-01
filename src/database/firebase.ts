import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as serviceAccount from "../../config/firebase-key.json";

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: process.env.STORAGE_BUCKET
});

const bucket = admin.storage().bucket();

interface Request {
  file?: { 
    originalname: string; 
    mimetype: string; 
    buffer: Buffer; 
    firebaseUrl?: string; 
  };
}

const uploadImage = (request: Request, res: any, next: () => void) => {
    if(!request.file) return next();
  
    const imagem = request.file!;
    const nomeArquivo = Date.now() + "." + imagem.originalname.split(".").pop();
  
    const file = bucket.file(nomeArquivo);
  
    const stream = file.createWriteStream({
      metadata: {
        contentType: imagem.mimetype,
      },
    });
  
    stream.on("error", (e) => {
      console.error(e);
    });
  
    stream.on("finish", async () => {
      // tornar o arquivo publico 
      await file.makePublic();
      imagem.firebaseUrl = `https://storage.googleapis.com/${process.env.STORAGE_BUCKET}/${nomeArquivo}`;
      next();
    });
  
    stream.end(imagem.buffer);
  };
  
export default uploadImage;
import {authenticatedUser} from '../server/auth.js';
import {createExerciseService} from '../server/exercises.js';
import {apiErrors,HttpError,json} from '../server/http.js';

const service=createExerciseService();
export function createExercisesHandler({env=process.env,load=service}={}) {
  return apiErrors(async(req,res)=>{
    if(!authenticatedUser(req,env))throw new HttpError(401,'Войди в аккаунт, чтобы открыть упражнения.');
    if(req.method!=='GET'){res.setHeader('Allow','GET');throw new HttpError(405,'Метод не поддерживается.');}
    const url=new URL(req.url,'http://localhost');
    return json(res,200,await load(url.searchParams));
  });
}
export default createExercisesHandler();

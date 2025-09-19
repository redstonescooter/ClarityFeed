import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });
import util from 'util';
import { log } from 'console';
type logger_options = {
    console_capture:boolean;
}
export class Logger{
    root_path:string;
    sqlDatetime:string;
    root_folder:string;
    current_file:string;
    current_file_index:number = 0;
    console_capture:ConsoleCapture;
    constructor(options:logger_options = {console_capture:true}){
        this.root_path = process.env.ROOT_FS_ABS + "logs/";
        this.sqlDatetime = new Date().toISOString()
        .slice(0, 19)
        .replace('T', ' ')
        .replace(/:/g, '-');
        this.init_root_folder();
        this.current_file = this.create_file();
        if(options.console_capture){
            this.console_capture = new ConsoleCapture();
            this.console_capture.override((msg) => this.log(msg));
        }
    }
    create_file(filename?:string){
        let file_path = this.root_folder + filename + ".log";
        if(filename == "" || filename == null){
            file_path = this.root_folder +  this.current_file_index + ".log";
            this.current_file_index++;
        }
        if(!fs.existsSync(file_path)){
            fs.writeFileSync(file_path, "");
        }else{
            throw new Error("File already exists");
        }
        return file_path;
    }
    create_folder(foldername:string = this.sqlDatetime){
        const folder_path = this.root_path + foldername ;
        if (!fs.existsSync(folder_path)) {
            fs.mkdirSync(folder_path, { recursive: true });
        }else{
            throw new Error("Folder already exists");
        }
        return folder_path + "/";
    }
    init_root_folder(){
        this.root_folder = this.create_folder();
    }
    log(message:any){
        if(typeof message == "string"){
            fs.appendFileSync(this.current_file, message + "\n");
        }else{
            fs.appendFileSync(this.current_file, util.inspect(message, { showHidden: true, depth: null, colors: true }) + "\n");
        }
    }
}

class ConsoleCapture {
    originalLog: (...data: any[]) => void;
    originalError: (...data: any[]) => void;
    originalWarn: (...data: any[]) => void;
    originalInfo: (...data: any[]) => void;
    constructor(){
        this.save_originals();
    }
    save_originals() {
        this.originalLog = console.log;
        this.originalError = console.error;
        this.originalWarn = console.warn;
        this.originalInfo = console.info;
    }

    restore_originals() {
        console.log = this.originalLog;
        console.error = this.originalError;
        console.warn = this.originalWarn;
        console.info = this.originalInfo;
    }

    override(cb:(message:any)=>any) {
        console.log = (...args) => {
            cb({ type: 'log', message: args });
            this.originalLog.apply(console, args);
          };
          console.error = (...args) => {
            cb({ type: 'error', message: args });
            this.originalError.apply(console, args);
          };
          console.warn = (...args) => {
            cb({ type: 'warn', message: args });
            this.originalWarn.apply(console, args);
          };
          console.info = (...args) => {
            cb({ type: 'info', message: args });
            this.originalInfo.apply(console, args);
          };
    }
}
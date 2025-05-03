import { configureStore } from "@reduxjs/toolkit";
import filesAndFoldersSlice from './filesAndFoldersSlice';

const store = configureStore({
    reducer: {
        filesAndFolders: filesAndFoldersSlice
    }
})


export default store;

import QuestBoard from './QuestBoard';
import Journal from './Journal';
import Treasures from './Treasures';
import Profile from './Profile';
import __Layout from '../Layout.jsx';


export const PAGES = {
    "QuestBoard": QuestBoard,
    "Journal": Journal,
    "Treasures": Treasures,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "QuestBoard",
    Pages: PAGES,
    Layout: __Layout,
};
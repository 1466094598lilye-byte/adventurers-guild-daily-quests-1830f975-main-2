import QuestBoard from './pages/QuestBoard';
import Journal from './pages/Journal';
import Treasures from './pages/Treasures';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


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
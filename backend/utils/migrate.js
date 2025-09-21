const mongoose = require('mongoose');
const Hymn = require('../models/Hymn');
const connectDB = require('../config/database');

const languageMap = {
  'Amharic': 'am',
  'Afan Oromo': 'om',
  'Tigrigna': 'ti',
  'English': 'en'
};

async function migrate() {
  try {
    await connectDB();
    console.log('Connected to database');
    
    const hymns = await Hymn.find({ language: { $exists: true } });
    for (const hymn of hymns) {
      const lang = languageMap[hymn.language];
      if (lang) {
        await Hymn.updateOne(
          { _id: hymn._id },
          { $set: { lang }, $unset: { language: '' } }
        );
        console.log(`Updated hymn ${hymn.title}: language=${hymn.language} to lang=${lang}`);
      } else {
        console.log(`No mapping for hymn ${hymn.title}: language=${hymn.language}`);
      }
    }
    
    const hymnsWithInvalidLang = await Hymn.find({ lang: { $nin: ['am', 'om', 'ti', 'en'] } });
    for (const hymn of hymnsWithInvalidLang) {
      const lang = languageMap[hymn.lang];
      if (lang) {
        await Hymn.updateOne(
          { _id: hymn._id },
          { $set: { lang } }
        );
        console.log(`Updated hymn ${hymn.title}: lang=${hymn.lang} to lang=${lang}`);
      } else {
        console.log(`No mapping for hymn ${hymn.title}: lang=${hymn.lang}`);
      }
    }
    
    console.log('Migration completed: renamed language to lang and mapped values');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
/* eslint-disable no-restricted-syntax */
const axios = require("axios");
const cheerio = require("cheerio");
const inquirer = require("inquirer");
const _ = require("lodash");
const fs = require("fs");

const searchByTitle = async (title) => {
  const formData = {
    query: title,
    l: "",
  };

  const urlEncoded = Object.keys(formData)
    .map((key) => `${key}=${encodeURIComponent(formData[key])}`)
    .join("&");

  const { data } = await axios({
    method: "POST",
    url: "https://subscene.com/subtitles/searchbytitle",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    data: urlEncoded,
  });
  const $ = cheerio.load(data);

  const titles = $(".title");
  const result = {};
  for (const element of titles) {
    const link = element.children[1].attribs.href;
    const name = element.children[1].children[0].data;
    result[name] = link;
  }
  return result;
};

const loadTitleResult = async (url) => {
  const { data } = await axios({
    method: "GET",
    url: `https://subscene.com/${url}`,
  });
  const $ = cheerio.load(data);

  const subtitles = $(".a1");
  const results = [];

  for (const element of subtitles) {
    const link = element.children[1].attribs.href;
    const language = element.children[1].children[1].children[0].data.trim();
    const name = element.children[1].children[3].children[0].data.trim();
    const getAuthor = _.get(
      element,
      "parent.children[7].children[1].children[0].data"
    );
    const author = getAuthor ? getAuthor.trim() : "";
    const result = {
      language,
      name,
      url: link,
      author,
    };
    results.push(result);
  }
  return results;
};

const downloadSubtitle = async (subtitle) => {
  const { data } = await axios({
    method: "GET",
    url: `https://subscene.com${subtitle.url}`,
  });

  const $ = cheerio.load(data);

  const downloadDiv = $(".download");
  const link = downloadDiv[0].children[1].attribs.href;

  const file = fs.createWriteStream(`${subtitle.name}.zip`);
  try {
    const response = await axios({
      url: `https://subscene.com${link}`,
      method: "GET",
      responseType: "stream",
    });
    response.data.pipe(file);
  } catch (error) {
    console.log(error);
  }
};

let titleResult;
let titleChoices = [];
let subtitleResult = [];
let languageChoices = [];
let episodeSelected;

const question1 = [
  {
    type: "input",
    name: "titleInput",
    message: "Please input title",
  },
];

const run = async () => {
  await inquirer.prompt(question1).then(async (answer) => {
    titleResult = await searchByTitle(answer.titleInput);
    titleChoices = Object.keys(titleResult);
  });

  const question2 = [
    {
      type: "list",
      name: "titleSelected",
      message: "Please select one of the results",
      choices: titleChoices,
      loop: false,
    },
  ];
  await inquirer.prompt(question2).then(async (answer) => {
    subtitleResult = await loadTitleResult(titleResult[answer.titleSelected]);
  });

  const languageMap = { English: 1 };
  subtitleResult.forEach((s) => {
    if (!languageMap[s.language]) {
      languageMap[s.language] = 1;
    }
  });
  languageChoices = Object.keys(languageMap);

  const question3 = [
    {
      type: "list",
      name: "languageSelected",
      message: "Select language",
      choices: languageChoices,
      loop: false,
    },
  ];

  await inquirer.prompt(question3).then(async (answer) => {
    subtitleResult = subtitleResult.filter(
      (s) => s.language === answer.languageSelected
    );
  });

  const episodesMap = {};
  const subRegex = /S[0-9][0-9]E[0-9][0-9]/gi;
  subtitleResult.forEach((sub) => {
    const found = subRegex.exec(sub.name);
    if (found) {
      const episodeUpperCase = found[0].toUpperCase();
      if (!episodesMap[episodeUpperCase]) {
        episodesMap[episodeUpperCase] = 1;
      }
    }
  });
  const episodes = Object.keys(episodesMap);

  const question4 = [
    {
      type: "list",
      name: "episodeSelected",
      message: "Select episode",
      choices: episodes,
      loop: false,
    },
  ];
  await inquirer.prompt(question4).then(async (answer) => {
    episodeSelected = answer.episodeSelected;
  });

  const subtitleChoices = [];
  subtitleResult.forEach((sub) => {
    const found = sub.name.toUpperCase().includes(episodeSelected);
    if (found) {
      subtitleChoices.push(`${sub.name} - author: ${sub.author}`);
    }
  });

  const question5 = [
    {
      type: "list",
      name: "subtitleSelected",
      message: "Select subtitle",
      choices: subtitleChoices,
      loop: false,
    },
  ];
  await inquirer.prompt(question5).then(async (answer) => {
    const selectedSub = answer.subtitleSelected.split("- author:")[0].trim();
    const found = subtitleResult.find((s) => s.name === selectedSub);
    if (found) {
      await downloadSubtitle(found);
    } else {
      console.log("Something went wrong");
    }
  });
};

run();

// loadTitleResult("legion-third-season");

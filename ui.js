$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $favoritedStories = $("#favorited-articles");
  const $userProfile = $('#user-profile');

  // global storyList variable
  let storyList = null;
  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successful we will setup the user instance
   */
  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit
    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();
    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successful we will setup a new user instance
   */
  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh
    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();
    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */
  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */
  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */
  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  /**
   * Event handler for Navigation to Submit Form
   */
  $("body").on("click", "#nav-submit", function() {
    // jquery hide or show element
    $submitForm.slideToggle();
  });

  /** 
   * Event handler for Submitting a story
   */
  $submitForm.on("click", "button", async function(e) {
    e.preventDefault();
    if (currentUser) {
      // get all info from input form
      const title = $("#title").val();
      const url = $("#url").val();
      const author = $("#author").val();
      const username = currentUser.username
      // call API to request to /stories to create the new story
      const newStory = await storyList.addStory(currentUser, {title, author, url, username});
      //generate HTML for new story
      const newAllStoryHTML = generateStoryHTML(newStory, false);
      const newMyStoryHTML = generateStoryHTML(newStory, true);
      // add to all-articles list
      $allStoriesList.prepend(newAllStoryHTML);
      //add to my-articles list
      $ownStories.prepend(newMyStoryHTML);
      // hide the form and reset all inputs
      $submitForm.slideToggle();
      $submitForm.trigger("reset");
    }
  });

  /**
   * Event handler for Navigation to Favorites
   */
  $("body").on("click", "#nav-favorites", function() {
    //make sure user is logged in
    if (currentUser) {
      //hide all articles list
      hideElements();
      //remove all favorites so it doesn't add the same favorites over and over
      $favoritedStories.empty();
      //show favorites list
      if (currentUser.favorites.length < 1) {
        $favoritedStories.append("<h5>No favorites added!</h5>");
      } else {
        for (let fave of currentUser.favorites) {
          $favoritedStories.append(generateStoryHTML(fave, false));
        }
      }
      $favoritedStories.show();
    }
  });

  /** 
   * Event handler for Favoriting a story
   */
  $("body").on("click", ".star", async function(e) {
    //make sure user is logged in
    if (currentUser) {
      let favedStory = e.target.closest('li');
      //if not favorited and favoriting 
      if (e.target.className.includes('far')) {
        e.target.classList.add('fas');
        e.target.classList.remove('far');
        await currentUser.faveOrUnfave(favedStory.id, true);
      //if favorited and removing favorite
      } else if (e.target.className.includes('fas')) {
        e.target.classList.add('far');
        e.target.classList.remove('fas');
        await currentUser.faveOrUnfave(favedStory.id, false);
      }
    }
  });

  /** 
   * Event handler for Trashing a story
   */
  $ownStories.on("click", ".trash-can", async function(e) {
    //make sure user is logged in
    if (currentUser) {
      let trashedStory = e.target.closest('li');
      //the story is removed from the API
      await storyList.trashStory(currentUser, trashedStory.id);
      //remove the story from the my story list
      debugger;
      trashedStory.remove();
      // go back to homepage essentially
      hideElements();
      await generateStories();
      $allStoriesList.show();
    }
  });

   /**
   * Event Handler for Profile
   */
  $('#nav-user-profile').on("click", function() {
    // hide all articles and show User Profile
    hideElements();
    $("#profile-name").text(`Name: ${currentUser.name}`);
    $("#profile-username").text(`Username: ${currentUser.username}`);
    $("#profile-account-date").text(`Account Created: ${currentUser.createdAt.slice(0,10)}`);
    $userProfile.show();
    //adds tan style to background of Profile
    $("#user-profile").addClass('container');
  });

  /**
   * Event Handler for My Stories
   */
  $('#nav-my-stories').on('click', function() {
    //make sure user is logged in
    if (currentUser) {
      //hide everything
      hideElements();
      //remove all my stories from my-story list so it doesn't add the same ones over and over
      $ownStories.empty();
      //show my stories list
      if (currentUser.ownStories.length < 1) {
        //if no stories show 'No stories added by user yet!'
        $ownStories.append("<h5>No stories added by user yet!</h5>");
      } else {
        for (let own of currentUser.ownStories) {
          //apend each story to my story list
          $ownStories.append(generateStoryHTML(own, true));
        }
      }
      // shwo full my-stories list
      $ownStories.show();
    }
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();
    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */
  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();
    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");
    // show the stories
    $allStoriesList.show();
    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */
  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();
    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story, false);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */
  function generateStoryHTML(story, ownStory) {
    let hostName = getHostName(story.url);
    let faveIds = [];
    let trashIcon = "";
    // check if story is part of user favorites and add filled in star if it is
    if(currentUser) {
      faveIds = currentUser.favorites.map(function(value) {
        return value.storyId;
      })
    }
    let fave = 'far';
    if (faveIds.includes(story.storyId)) {
      fave = 'fas';
    }
    // if the story is the user's own story add a trash icon
    if (ownStory) {
      trashIcon = `<span class="trash-can">
                          <i class="fas fa-trash-alt"></i>
                        </span>`
    }
    // render story markup including if fave or not and if in own story list add trash icon
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${trashIcon}
        <span class="star">
          <i class="${fave} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);
    return storyMarkup;
  }

  /* hide all elements in elementsArr */
  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $favoritedStories,
      $userProfile
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $('.logged-in-links').toggleClass('hidden');
    $('#nav-welcome').show();
    $('#nav-user-profile').text(currentUser.username);
  }

  /* simple function to pull the hostname from a URL */
  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */
  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});

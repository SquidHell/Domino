/* --------------------------------------------------------------------------
   Domino 2048 — branchement Y8 (minimal SDK 2.0)
   Le jeu ne connaît aucune régie : il expose Domino.setAdProvider(), et ce
   fichier fournit la régie Y8. Si le SDK ne charge pas, aucun provider n'est
   branché : les boutons de bonus restent masqués et le jeu reste jouable.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var APP_ID  = "6a942d3c1ee8fcff5a9e962b";
  var GAME_ID = "281811";

  // Fréquence des interstitiels : jamais deux parties de suite, jamais à moins
  // de 90 s d'intervalle. Les récompensées, elles, sont toujours à la demande
  // du joueur, donc jamais bridées.
  var EVERY_N_GAMES = 2;
  var MIN_GAP_MS    = 90000;

  // Filet de sécurité : si le SDK ne rappelle jamais adBreakDone, on rend la
  // main au joueur au lieu de laisser le bouton bloqué.
  var WATCHDOG_MS = 60000;

  var y8Sdk = null;
  var player = null;
  var gamesSinceAd = 0;
  var lastAdAt = 0;
  var adInFlight = false;

  function log() {
    if (window.console) console.log.apply(console, ["[y8]"].concat([].slice.call(arguments)));
  }

  var provider = {
    /* Pub récompensée : la récompense n'est accordée que sur adViewed.
       adDismissed (pub passée) et toute erreur repassent par skipped(), le jeu
       affiche alors un message et ne donne rien. */
    showRewarded: function (name, cb) {
      if (!y8Sdk) { cb.skipped("Publicité indisponible pour le moment."); return; }
      if (adInFlight) { cb.skipped("Une publicité est déjà en cours."); return; }

      var viewed = false, settled = false, timer = null;
      function settle(ok, message) {
        if (settled) return;
        settled = true;
        adInFlight = false;
        if (timer) clearTimeout(timer);
        Domino.resume();
        if (ok) cb.granted(); else cb.skipped(message);
      }

      adInFlight = true;
      timer = setTimeout(function () {
        settle(false, "La publicité n'a pas pu se lancer.");
      }, WATCHDOG_MS);

      y8Sdk.showAd({
        type: "reward",
        name: name,
        beforeAd: function () { Domino.pause(); },
        afterAd:  function () { Domino.resume(); },
        beforeReward: function (showAdFn) { showAdFn(); },
        adDismissed: function () { log("récompensée passée :", name); },
        adViewed: function () { viewed = true; },
        adBreakDone: function (info) {
          log("récompensée terminée :", name, info && info.breakStatus);
          settle(viewed, "Pas de récompense : la publicité n'a pas été regardée jusqu'au bout.");
        }
      })["catch"](function (e) {
        log("erreur récompensée :", e);
        settle(false, "Publicité indisponible pour le moment.");
      });
    },

    /* Interstitiel entre deux parties. Silencieux : rien à accorder, et on ne
       dérange le joueur qu'une partie sur deux au maximum. */
    showInterstitial: function (name) {
      if (!y8Sdk || adInFlight) return;
      gamesSinceAd++;
      if (gamesSinceAd < EVERY_N_GAMES) return;
      if (Date.now() - lastAdAt < MIN_GAP_MS) return;
      gamesSinceAd = 0;
      lastAdAt = Date.now();

      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        adInFlight = false;
        Domino.resume();
      }
      adInFlight = true;
      setTimeout(done, WATCHDOG_MS);

      y8Sdk.showAd({
        type: "next",
        name: name,
        beforeAd: function () { Domino.pause(); },
        afterAd:  function () { Domino.resume(); },
        adBreakDone: function (info) {
          log("interstitiel terminé :", name, info && info.breakStatus);
          done();
        }
      })["catch"](function (e) {
        log("erreur interstitiel :", e);
        done();
      });
    }
  };

  function start() {
    y8Sdk = y8.sdk();

    var appConfig = {
      appId: APP_ID,
      autoLogin: true
    };

    var adConfig = {
      gameId: GAME_ID,
      preloadAdBreaks: "on",
      sound: "on",
      onReady: function () { log("régie prête"); }
    };

    y8Sdk.init(appConfig, adConfig);

    y8Sdk.onAuth(function (user, error) {
      player = error ? null : user;
      log(error ? "joueur non connecté" : "joueur connecté");
      // Point d'accroche pour un futur classement Y8 : `player` est disponible ici.
    });

    if (window.Domino) Domino.setAdProvider(provider);
    else window.addEventListener("domino.ready", function () { Domino.setAdProvider(provider); }, { once: true });
  }

  window.addEventListener("y8sdk.ready", start, { once: true });

  // Le SDK peut déjà être chargé quand ce script s'exécute.
  if (window.y8 && window.y8.emitReadyEvent) window.y8.emitReadyEvent();
})();

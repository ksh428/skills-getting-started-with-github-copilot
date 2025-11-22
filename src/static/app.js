document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activityTemplate = document.getElementById("activity-template");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageEl = document.getElementById("message");

  function showMessage(text, type = "info") {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
  }

  function clearMessage() {
    messageEl.textContent = "";
    messageEl.className = "hidden";
  }

  function initialsFromEmail(email) {
    const local = (email || "").split("@")[0] || "";
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length === 0) return email.charAt(0).toUpperCase() || "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function createParticipantItem(email, activityName) {
    const li = document.createElement("li");
    li.className = "participant-item";

    const badge = document.createElement("span");
    badge.className = "participant-initial";
    badge.textContent = initialsFromEmail(email);

    const text = document.createElement("span");
    text.className = "participant-email";
    text.textContent = email;

    const removeBtn = document.createElement("button");
    removeBtn.className = "participant-remove";
    removeBtn.setAttribute("aria-label", `Remove ${email}`);
    removeBtn.title = `Remove ${email}`;
    removeBtn.type = "button";
    removeBtn.textContent = "✖";

    removeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearMessage();

      try {
        const url = `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`;
        const res = await fetch(url, { method: "DELETE" });
        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const detail = payload.detail || payload.message || res.statusText || "Unregister failed";
          showMessage(detail, "error");
          return;
        }

        // Remove the list item from the DOM and update count
        const card = li.closest('.activity-card');
        const list = card?.querySelector('.participants-list');
        const countEl = card?.querySelector('.participants-count');
        li.remove();

        if (list && list.children.length === 0) {
          const hint = document.createElement('li');
          hint.className = 'no-participants';
          hint.textContent = 'No participants yet.';
          list.appendChild(hint);
        }

        if (countEl) {
          const newCount = Math.max(0, Number(countEl.textContent || 0) - 1);
          countEl.textContent = String(newCount);
        }

        showMessage(payload.message || `Unregistered ${email} from ${activityName}`, "success");
      } catch (err) {
        showMessage(err.message || "Unregister failed", "error");
      }
    });

    li.appendChild(badge);
    li.appendChild(text);
    li.appendChild(removeBtn);
    return li;
  }

  function renderActivities(data) {
    // clear existing
    activitiesList.innerHTML = "";

    // populate select default
    // keep the existing default option
    while (activitySelect.options.length > 1) {
      activitySelect.remove(1);
    }

    const names = Object.keys(data).sort();
    if (names.length === 0) {
      const p = document.createElement("p");
      p.className = "info";
      p.textContent = "No activities available.";
      activitiesList.appendChild(p);
      return;
    }

    names.forEach((name) => {
      const activity = data[name];
      // add option to select
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      activitySelect.appendChild(opt);

      // clone template
      const node = activityTemplate.content.cloneNode(true);
      const article = node.querySelector(".activity-card");
      article.setAttribute("data-activity", name);

      const title = node.querySelector(".activity-name");
      if (title) title.textContent = name;

      const desc = node.querySelector(".activity-desc");
      if (desc) desc.textContent = activity.description || "";

      const sched = node.querySelector(".activity-schedule span");
      if (sched) sched.textContent = activity.schedule || "";

      const countEl = node.querySelector(".participants-count");
      const listEl = node.querySelector(".participants-list");

      // fill participants
      const participants = Array.isArray(activity.participants) ? activity.participants : [];
      if (participants.length === 0) {
        // show a subtle hint item
        const hint = document.createElement("li");
        hint.className = "no-participants";
        hint.textContent = "No participants yet.";
        listEl.appendChild(hint);
      } else {
        participants.forEach((email) => {
          listEl.appendChild(createParticipantItem(email, name));
        });
      }
      if (countEl) countEl.textContent = String(participants.length);

      // wire signup button in card to pre-select activity in form
      const signupBtn = node.querySelector(".signup-btn");
      if (signupBtn) {
        signupBtn.addEventListener("click", () => {
          activitySelect.value = name;
          window.scrollTo({ top: signupForm.getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
          const emailInput = document.getElementById("email");
          emailInput?.focus();
        });
      }

      activitiesList.appendChild(node);
    });
  }

  // Fetch activities from the server
  async function loadActivities() {
    try {
      clearMessage();
      const res = await fetch("/activities");
      if (!res.ok) throw new Error(`Failed to load activities (${res.status})`);
      const data = await res.json();
      renderActivities(data);
    } catch (err) {
      activitiesList.innerHTML = "";
      const p = document.createElement("p");
      p.className = "error";
      p.textContent = "Unable to load activities. Try again later.";
      activitiesList.appendChild(p);
      showMessage(err.message || "Error loading activities", "error");
    }
  }

  // Handle signup form
  signupForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearMessage();

    const email = document.getElementById("email").value.trim();
    const activityName = activitySelect.value;

    if (!email || !activityName) {
      showMessage("Please provide an email and select an activity.", "error");
      return;
    }

    try {
      const url = `/activities/${encodeURIComponent(activityName)}/signup?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: "POST" });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = payload.detail || payload.message || res.statusText || "Signup failed";
        showMessage(detail, "error");
        return;
      }

      showMessage(payload.message || `Signed up ${email} for ${activityName}`, "success");

      // Update the participants list in the card
      const card = document.querySelector(`.activity-card[data-activity=${CSS.escape(activityName)}]`);
      if (card) {
        const list = card.querySelector(".participants-list");
        const countEl = card.querySelector(".participants-count");
        // remove "no participants" hint if present
        const noNode = list.querySelector(".no-participants");
        if (noNode) noNode.remove();

        // append new item and bump count
        list.appendChild(createParticipantItem(email, activityName));
        if (countEl) {
          const newCount = Number(countEl.textContent || 0) + 1;
          countEl.textContent = String(newCount);
        }
      }

      // clear email input
      document.getElementById("email").value = "";
    } catch (err) {
      showMessage(err.message || "Signup failed", "error");
    }
  });

  // initial load
  loadActivities();
});

# Kozilek, The Sentinel 👁️‍🗨️

**Kozilek, The Sentinel** is an open-source, self-improving age verification system for Discord servers. It learns to recognize and counter new bypass techniques in real time, making it a dynamic and resilient guardian against underage users.

<br>

---

<br>

## What It Does

Kozilek, The Sentinel goes beyond traditional age-gating by leveraging a powerful, two-pronged approach:

- **The Sentinels:** A lightweight, rule-based bot that operates as the first line of defense, powered by your self-hosted services.
- **The Truthwarper:** A powerful AI adversary that analyzes failed verification attempts, learns new bypass patterns, and automatically updates the Sentinels' rules to keep the system robust.

This project is a hybrid of a self-hosted Discord bot and a cloud-based AI, designed for scalability and continuous learning.

<br>

---

<br>

## Project Architecture

Kozilek, The Sentinel is built on a **microservices architecture**, with each component having a specific role.

- **The Sentinels** 🛡️: The Discord bot client and verification engine. This is the front-facing part of the project that runs in Docker containers on your Synology NAS.
- **The Titan's Eye** 👀: The MongoDB database that serves as the repository for all user interactions and rules. This can be self-hosted or run on a managed service like MongoDB Atlas.
- **The Truthwarper** 🌀: The AI adversary service. This component, written in Python, is hosted in the cloud to handle the intensive machine learning tasks.

<br>

---

<br>

## Getting Started

To get the bot up and running, you'll need to set up the following services:

### Prerequisites

- A Discord Developer Application with a Bot Token
- [Docker](https://www.docker.com/) installed on your host machine (e.g., a Synology NAS)
- A MongoDB Atlas account (free tier is sufficient) or a self-hosted MongoDB instance

### Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/61ZM07H36R3ML1N/Kozilek-The-Sentinel.git](https://github.com/61ZMO7H36R3ML1N/Kozilek-The-Sentinel.git)
    cd Kozilek-The-Sentinel
    ```
2.  **Configure Your Environment:**
    - Create a `.env` file in the root directory.
    - Add your Discord Bot Token and MongoDB connection string:
      ```
      DISCORD_TOKEN=your_token_here
      MONGODB_URI=your_mongodb_uri_here
      ```
3.  **Run the Sentinels:**
    - Navigate to the `sentinels` directory and use Docker to build and run the containers.
    - ````bash
          docker-compose up --build
          ```
      (Note: You will need to create a `docker-compose.yml` file to orchestrate your services.)
      ````

<br>

---

<br>

## How to Contribute

We welcome contributions of all kinds, from code and bug fixes to documentation and new ideas. Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for a detailed guide on how to get started.

## License

This project is licensed under the **[MIT License](LICENSE)**.

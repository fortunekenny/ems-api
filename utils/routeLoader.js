/*import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

// Dynamically load all routes from the 'routes' directory
const loadRoutes = async (app, routesPath) => {
  const files = await fs.readdir(routesPath);

  for (const file of files) {
    const routePath = path.join(routesPath, file);
    const routeUrl = pathToFileURL(routePath).href; // Convert to file URL
    const routeModule = await import(routeUrl); // Dynamically import

    // Assuming your route modules export a default function to handle the routes
    app.use(`/api/${file.split(".")[0]}`, routeModule.default);
  }
};

export default loadRoutes;
*/

// // Usage example:
// const routesPath = path.join(__dirname, "routes");
// await loadRoutes(app, routesPath);

/*
import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const loadRoutes = async (app, routesPath) => {
  const files = await fs.readdir(routesPath);

  for (const file of files) {
    const routePath = path.join(routesPath, file);
    const routeUrl = pathToFileURL(routePath).href; // Convert to file URL
    const routeModule = await import(routeUrl); // Dynamically import

    // Assuming your route modules export a router
    app.use(`/api/${file.split(".")[0]}`, routeModule.default);
    console.log(`Loading route: ${file.split(".")[0]}`); // Confirm routes are loading
  }
};

export default loadRoutes;*/

/*
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const loadRoutes = (app, routesPath) => {
  fs.readdirSync(routesPath).forEach((file) => {
    // Get full path of the route file
    const routePath = path.join(routesPath, file);

    // Import the route dynamically
    import(routePath).then((module) => {
      const route = module.default;
      const routeBase = file.replace(/Routes\.js$/, "");

      // Automatically set up the route at `/api/v1/<routeBase>`
      app.use(`/api/v1/${routeBase}`, route);
    });
  });
};

export default loadRoutes;
*/

import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const loadRoutes = async (app, routesPath) => {
  const files = await fs.readdir(routesPath);

  for (const file of files) {
    // Get full path of the route file
    const routePath = path.join(routesPath, file);
    const routeUrl = pathToFileURL(routePath).href; // Convert to file URL
    const routeModule = await import(routeUrl); // Dynamically import

    // Assuming your route modules export a router
    const routeBase = file.replace(/Routes\.js$/, ""); // Remove 'Routes.js' from the filename
    app.use(`/api/v1/${routeBase}`, routeModule.default); // Set up the route at /api/v1/<routeBase>

    // console.log(`Loading route: ${routeBase}`); // Confirm routes are loading
  }
};

export default loadRoutes;

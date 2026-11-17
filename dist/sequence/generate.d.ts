import { GeneratorRegistry } from "../types/generator.js";
import { Page } from "../types/page.js";
import { Site } from "../types/site.js";
export declare function seqGenerate(site: Site, generators: GeneratorRegistry): Promise<Page[]>;

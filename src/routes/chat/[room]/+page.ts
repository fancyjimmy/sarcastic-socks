import type { PageLoad } from "./$types";

export const ssr = false;
export const prerender = false;
export const csr = true;

export const load: PageLoad = async ({params}) => {
    return {
        room: params.room
    }
};
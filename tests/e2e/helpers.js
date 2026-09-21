import {expect} from '../../frontend/node_modules/@playwright/test/index.mjs';
export async function login(page){await page.goto('/');await expect(page.getByRole('heading',{name:/From field evidence/})).toBeVisible();}
export async function submit(page,text){await page.getByRole('link',{name:'Submit report',exact:true}).click();await page.getByLabel('Field report',{exact:true}).fill(text);await page.getByRole('button',{name:'Submit report',exact:true}).click();await expect(page.getByRole('status')).toContainText('Report saved');}

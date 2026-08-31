import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import PublicView from './views/PublicView.vue';
import AdminView from './views/AdminView.vue';
import AdminEmployeeEditView from './views/AdminEmployeeEditView.vue';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PublicView },
    { path: '/admin', component: AdminView },
    {
      path: '/admin/employees/:empEntryId/edit',
      name: 'admin-employee-edit',
      component: AdminEmployeeEditView,
      props: true
    }
  ]
});

createApp(App).use(router).mount('#app');

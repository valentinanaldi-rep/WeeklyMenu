describe('Weekly Menu smoke', () => {
  it('renders the app and its week view', () => {
    cy.visit('/')
    cy.get('[data-testid="home-title"]').should('contain.text', 'Weekly Menu')
    cy.get('[data-testid="week-range"]').should('exist')
    cy.get('[data-testid="prev-week"]').should('exist')
    cy.get('[data-testid="next-week"]').should('exist')
    cy.get('[data-testid="lunch-0"]').should(exist => {
      expect((exist[0] as HTMLElement).textContent).to.contain('Pranzo')
    })
    cy.get('[data-testid="edit-pencil"]').should('exist')
  })

  it('shows the brand icon beside the title and the hamburger on the right', () => {
    cy.visit('/')
    cy.get('[data-testid="home-title"] img').should('have.attr', 'src', '/icon.png')
    cy.get('[data-testid="menu-toggle"]').should('be.visible')
    cy.get('[data-testid="home-title"]').parents('ion-toolbar').then(toolbar => {
      const tb = toolbar[0].getBoundingClientRect()
      cy.get('[data-testid="menu-toggle"]').then(toggle => {
        const t = toggle[0].getBoundingClientRect()
        expect(t.left).to.be.greaterThan(tb.left + tb.width / 2)
      })
    })
  })

  it('enters edit mode and cancels without writing', () => {
    cy.visit('/')
    cy.get('[data-testid="edit-pencil"]').click()
    cy.get('[data-testid="edit-save"]').should('exist')
    cy.get('[data-testid="edit-cancel"]').should('exist')
    cy.get('[data-testid="lunch-0"]').then(el => {
      expect((el[0] as HTMLElement).tagName).to.eq('TEXTAREA')
    })
    cy.get('[data-testid="edit-cancel"]').click()
    cy.get('[data-testid="edit-pencil"]').should('exist')
  })
})